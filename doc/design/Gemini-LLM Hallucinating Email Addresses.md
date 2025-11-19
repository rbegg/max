# LLM Hallucinating Email Addresses

**Exported:** 11/18/2025 11:00:35  
**Link:** [https://gemini.google.com/app/03166441c97de4e3](https://gemini.google.com/app/03166441c97de4e3)

## Prompt:
> agent - PY

> graph - PY

> prompts - PY

> person_tools - PY

> gmail_tools - PY

for the max project, i am using the llama3.1:8b-instruct-q4\_K\_M model and the langgraph implemented in graph.py. There are tools defined liked the person tools and gmail tools. When i ask to send an email to a name, i expected the llm to reason that it should look up the name, get the email address , then use the address to send the email. Instead, the llm hulicinated the email and sent it. Can i expect this model to be able to reason out multiple steps like this?

## Response:
Based on your architecture and the specific model you are using (**Llama 3.1 8B Quantized**), here is the direct answer and a set of concrete solutions to fix the behavior.

### The Direct Answer

**No, you cannot reliably expect the 8B Q4 model to reason out "implicit" multiple steps without very strong guidance.**

While Llama 3.1 8B is capable of tool use, it suffers from "eagerness." When it sees the user request "Send email to Ryan," and it sees a tool `send_message(to, ...)`, it tries to satisfy the user's request in a single turn to be efficient. Because it doesn't have the email address in context, it hallucinates one to satisfy the function signature.

To make this work with an 8B model, you must move the constraint from "implicit reasoning" to "explicit instruction" within your Prompt and Tool Definitions.

Here are three steps to fix this without changing your graph architecture.

* * *

### 1\. Strengthen the System Prompt

You need to explicitly forbid the model from guessing emails. Update `prompts.py` to include a specific rule about email operations.

**In `max_assistant/agent/prompts.py`:**

Modify your `senior_assistant_prompt` system message. Add a rule specifically for tools:

```
# ... existing imports

senior_assistant_prompt = ChatPromptTemplate.from_messages([
    ("system", """
# Persona
You are "Companion, named Max" a friendly...
...

# Rules
* **NEVER** provide medical or financial advice...
* **NEVER** guess or hallucinate email addresses. If asked to send an email to a name (e.g., "Ryan"), you MUST first use the `find_person_by_name` tool to retrieve their email address.
* If the person is not found or has no email, ask the user for the address.
* Keep your responses clear and concise...

# Tool Handling Instructions
...
"""),
    # ... rest of file
])
```

### 2\. Update the Tool Description

The LLM relies heavily on the docstring of the tool to know _how_ to use it. You should modify the description in `gmail_tools.py` to explicitly warn the model about the `to` argument.

**In `max_assistant/tools/gmail_tools.py`:**

Change the description in the `get_tools` method:

```
    def get_tools(self) -> list:
        return [
            StructuredTool.from_function(
                func=None,
                coroutine=self.send_message,
                name="send_gmail_message",
                # UPDATED DESCRIPTION BELOW
                description=(
                    "Sends an email. The 'to' argument must be a valid EMAIL ADDRESS (e.g., bob@gmail.com), "
                    "NOT a person's name. If you only have a name, you must search for the person first "
                    "to get their email."
                ),
                args_schema=SendGmailArgs
            ),
        ]
```

### 3\. Verify Pydantic Models (Hidden Context)

I noticed `find_person_by_name` in `person_tools.py` returns a dump of `PersonDetails`. You must ensure your `PersonDetails` Pydantic model (in `max_assistant/models/person_models.py`) actually includes an `email` field.

If the LLM calls `find_person_by_name` and the resulting JSON _doesn't_ contain an email field, the LLM will fall back to hallucinating one again.

### Why this happens (Technical Context)

In `graph.py`, your workflow is:

1.  `prepare_input`
2.  `agent` (Call Model)
3.  `should_continue` -\> `execute_tools` OR `end`

When using **Llama 3.1 8B**, the model looks at the tools as a menu.

*   **User:** "Email Ryan."
*   **Model logic (Weak):** "I see a tool `send_email`. It needs a `to` field. The user said 'Ryan'. I'll just put 'ryan@gmail.com' so I can finish the job."
*   **Model logic (Strong/Prompted):** "I see a tool `send_email`. The description says 'to' MUST be an email address. I only have the name 'Ryan'. I see another tool `find_person`. I must call `find_person` first."

By implementing the prompt and docstring changes above, you force the 8B model into the "Strong" logic path.

## Prompt:
is there an option to change the graph to create a plan then execute the plan

## Response:
Yes, there is a standard architecture for this called **Plan-and-Execute**.

Using the Llama 3.1 8B model, shifting from a pure ReAct loop (what you have now) to a Plan-and-Execute style is highly effective. It forces the model to "think" before it "acts," which usually cures the specific hallucination problem you are seeing with the email address.

Here is how to modify your `graph.py` and `state.py` to implement a **Planner Node** that runs before your main Agent.

### 1\. Update the State

First, you need to add a field to your state to hold the generated plan. **File:** `max_assistant/agent/state.py` (or wherever `GraphState` is defined)

```
from typing import TypedDict, Annotated, List
import operator
from langchain_core.messages import BaseMessage

class GraphState(TypedDict):
    messages: Annotated[List[BaseMessage], operator.add]
    userinfo: dict
    thread_id: str
    transcribed_text: str
    voice: str
    # --- ADD THIS ---
    plan: str 
```

### 2\. Create the Planner Prompt

Create a specific prompt that knows about your tools and forces a step-by-step breakdown. **File:** `max_assistant/agent/prompts.py`

```
# Add this to your imports
from langchain_core.prompts import ChatPromptTemplate

planner_prompt = ChatPromptTemplate.from_messages([
    ("system", """
You are a planner for an AI assistant. 
Your job is to break down the user's request into a step-by-step plan.
You have access to the following tools:
- find_person_by_name: Finds a person's details (email, address, etc.)
- send_gmail_message: Sends an email (Requires a fetched email address, DO NOT GUESS).
- (List other relevant tools here...)

RULES:
1. If the user asks to email someone, your plan MUST include finding the person first to get their email.
2. Keep the steps concise.
3. Output ONLY the numbered list of steps. Do not add introductory text.
"""),
    ("human", "{input}")
])
```

### 3\. Implement the Planner Node

Now, add the logic to generate the plan and inject it into the context for the main agent. **File:** `graph.py`

```
# ... existing imports
from max_assistant.agent.prompts import planner_prompt # Import the new prompt

# ... existing code ...

async def create_reasoning_engine(
        llm: ChatOllama,
        # ... args ...
    ):

    # ... tools initialization ...

    # --- NEW NODE: Planner ---
    async def plan_step(state: GraphState):
        """
        Generates a plan based on the user's input and updates the state.
        """
        logger.info("Node: plan_step")
        
        # Create the planning chain
        planner_chain = planner_prompt | llm
        
        # Generate the plan using the latest user input
        # Note: We use transcribed_text because messages might be messy
        response = await planner_chain.ainvoke({"input": state["transcribed_text"]})
        
        logger.info(f"Generated Plan: {response.content}")
        return {"plan": response.content}

    # --- UPDATED NODE: Call Model ---
    async def call_model(state: GraphState):
        """
        Invokes the LLM. We now inject the PLAN into the system prompt.
        """
        logger.info("Calling model with current history.")
        
        chain = senior_assistant_prompt | llm_with_tools
        
        # --- LOGIC CHANGE: Inject Plan ---
        # We construct a temporary system message update or append it to the user message
        # Here, we pass it into the 'messages' list as a distinct system note
        
        current_plan = state.get("plan", "")
        messages = state["messages"]
        
        # If a plan exists, we remind the agent of it
        if current_plan:
            # We add a system instruction at the end of the history effectively
            # forcing the model to look at the plan before acting.
            from langchain_core.messages import SystemMessage
            plan_message = SystemMessage(content=f"CURRENT PLAN:\n{current_plan}\n\nFollow these steps. Do not skip steps.")
            messages = messages + [plan_message]

        response = await chain.ainvoke({
            "user_info": state["userinfo"],
            "current_datetime": current_datetime(),
            "messages": messages, 
        })

        # ... rest of existing call_model logic ...
```

### 4\. Rewire the Graph

Finally, insert the `planner` node between `prepare_input` and `agent`. **File:** `graph.py`

```
    # ... inside create_reasoning_engine ...

    workflow = StateGraph(GraphState)

    workflow.add_node("prepare_input", prepare_input)
    workflow.add_node("planner", plan_step)  # <--- Add Planner Node
    workflow.add_node("prune", prune_messages)
    workflow.add_node("agent", call_model)
    workflow.add_node("execute_tools", ToolNode(tools))

    # Edges
    workflow.set_entry_point("prepare_input")
    workflow.add_edge("prepare_input", "planner") # Input -> Planner
    workflow.add_edge("planner", "prune")         # Planner -> Prune
    workflow.add_edge("prune", "agent")           # Prune -> Agent
    
    # The rest of the loop remains the same (Agent -> Tools -> Agent)
    workflow.add_conditional_edges(
        "agent",
        should_continue,
        {
            "execute_tools": "execute_tools",
            "end": END,
        },
    )
    workflow.add_edge("execute_tools", "agent")

    return workflow.compile()
```

### Why this works for Llama 3.1 8B

When the Agent node runs now, its context window looks like this:

1.  **User:** "Email Ryan."
2.  **System (Plan):** "1. Use `find_person_by_name` to find Ryan. 2. Extract email. 3. Send email."

Because the instructions are explicitly in the context window immediately preceding the decision, the 8B model is significantly less likely to skip step 1 and "hallucinate" the email address.

### Next Step

Would you like me to generate the specific `planner_prompt` text formatted for your `prompts.py` file?

## Prompt:
can the plan inlcude asking the user for more information, example, Send fred a message, results in, what to do you want to ask fred?

## Response:
Yes, this is a standard pattern often called **"Human-in-the-loop" planning** or **"Clarification steps."**

For a quantized 8B model, the best approach is to treat "Asking the User" as a valid step in the plan. If the planner detects that a tool requires an argument (like `message_text`) that is missing from the conversation history, the generated plan should stop at "Ask the user for X."

Here is how to update your **Planner Prompt** to handle this intelligently without changing your graph structure significantly.

### 1\. The Concept: Continuous Planning

Instead of creating one static plan that stays forever, the Planner Node runs at the start of _every_ turn.

1.  **Turn 1:** User says "Email Fred." -\> Planner sees missing `message_text`. -\> Plan: "Ask user for message."
2.  **Turn 2:** User says "Happy Birthday." -\> Planner sees `message_text` exists but email address is missing. -\> Plan: "1. Find Fred's email. 2. Send email."

### 2\. Updated Planner Prompt

You need to explicitly teach the planner the "Required Arguments" for your tools. Update the prompt in `prompts.py`.

**File:** `max_assistant/agent/prompts.py`

```
planner_prompt = ChatPromptTemplate.from_messages([
    ("system", """
You are a senior AI assistant planner. 
Your job is to verify if you have enough information to execute the user's request.

# Tool Requirements
1. **send_gmail_message**: 
   - Needs: `to` (email address), `message_text` (body).
   - If `message_text` is missing: Your plan MUST be to ask the user what they want to say.
   - If `to` is a name (e.g., "Fred"): Your plan MUST be to use `find_person_by_name` first.

2. **find_person_by_name**:
   - Needs: `first_name` or `last_name`.

# Logic
- Review the Conversation History.
- If a required piece of information (like the message body) is missing, your ONLY step is to ask the user for it.
- Do not plan the tool execution until you have all the data.

# Output Format
Output a numbered list of steps.
Example 1 (Missing Body):
1. Ask the user what they want to write in the email.

Example 2 (Have Body, need Email):
1. Search for "Fred" to find his email address.
2. If email found, send the message "Happy Birthday".

Example 3 (Have Body and Email):
1. Send email to "fred@example.com" with content "Happy Birthday".
"""),
    ("human", "Conversation History:\n{history}\n\nCurrent Input: {input}")
])
```

### 3\. Update the Planner Node to pass History

The planner needs to know what was said previously to know if it _already_ has the message body.

**File:** `graph.py`

```
    async def plan_step(state: GraphState):
        """
        Generates a plan based on the user's input and history.
        """
        logger.info("Node: plan_step")
        
        # Combine recent messages into a string for the planner context
        # This helps it know if the user JUST provided the message body
        history = "\n".join([f"{m.type}: {m.content}" for m in state["messages"][-4:]])
        
        planner_chain = planner_prompt | llm
        
        response = await planner_chain.ainvoke({
            "history": history,
            "input": state["transcribed_text"]
        })
        
        logger.info(f"Generated Plan: {response.content}")
        return {"plan": response.content}
```

### 4\. How the Agent Handles It

You do not need to change the `agent` node logic from the previous step.

*   If the plan is "1. Ask the user what to write," the Agent (Llama 3) will see that in its system prompt.
*   It will realize it has no tool to "Ask User," so it will simply generate a natural language response: _"What would you like me to say to Fred?"_
*   This completes the turn and returns control to the user.

### Summary of Flow

| User Input | Planner Output | Agent Action |
| --- | --- | --- |
| **"Send Fred a message"** | "1. Ask user for message content." | Agent: "Sure, what would you like to say to Fred?" |
| **"Ask him if he's coming for dinner"** | "1. Find Fred's email.<br><br>  <br><br>2\. Send email about dinner." | Agent: Calls `find_person("Fred")`... |

This approach prevents the "Eager Execution" problem where the model sends blank emails or hallucinates content just to finish the job.

## Prompt:
does the prompt have to provide the tool information? I thought using the StructureTool.fromFunction() and then regiostering them took care of that.

## Response:
This is a great question. You are technically correct: `StructuredTool.from_function` (and the subsequent `bind_tools`) **does** provide the model with the tool names, descriptions, and parameter schemas.

However, there is a critical distinction between **Execution** (Agent Node) and **Reasoning/Planning** (Planner Node), especially for the Llama 3.1 8B model you are using.

Here is why you still need to provide tool info in the **Planner Prompt**, and how to automate it so you don't have to type it out manually.

### 1\. The "Planner" doesn't "see" the tools

In the code snippet I provided for the Planner Node:

```
# My previous code recommendation
planner_chain = planner_prompt | llm
```

Notice that `llm` here is **not** bound with tools (unlike `llm_with_tools` in your Agent node).

*   Because the tools aren't bound to this specific chain, the model has **zero knowledge** that these tools even exist unless you write them in the prompt.
*   **Why not just bind them?** If you bind tools to the Planner (`planner_prompt | llm.bind_tools(tools)`), the model might get confused and try to _call_ the tool immediately instead of writing a text plan. We want it to _talk about_ the tools, not _execute_ them.

### 2\. Small Models need "Cheatsheets"

Even if the model "knows" the tools exist, 8B models often struggle to infer **constraints** from a JSON schema alone.

*   **Schema says:** `to: string`.
*   **Model thinks:** "Okay, I'll put a name there."
*   **Prompt says:** "The 'to' argument MUST be an email address."
*   **Model thinks:** "Ah, I need to find the email first."

The prompt acts as a "Strategy Guide," while the `StructuredTool` definition acts as the "Syntax Guide."

### The Fix: Don't Duplicate Work (Automate It)

You don't have to manually hardcode the tool list in the prompt string every time you add a new function. You can generate the tool documentation string **dynamically** from your actual tool objects.

Here is how to modify `graph.py` to inject your tool definitions into the prompt automatically.

#### Step 1: Update the Planner Prompt to use a Variable

In `prompts.py`, replace the hardcoded list with `{tool_descriptions}`.

```
# prompts.py
planner_prompt = ChatPromptTemplate.from_messages([
    ("system", """
You are a planner. Break down the user's request into steps.
You have access to the following tools:

{tool_descriptions}

RULES:
1. If a tool requires an argument you don't have (like an email), plan to find it first.
2. If information is missing, plan to ask the user.
"""),
    ("human", "History: {history}\nInput: {input}")
])
```

#### Step 2: Create a Helper to "Render" Tools to Text

In `graph.py` (or a utility file), add a function that converts your list of tools into a readable string for the LLM.

```
# graph.py

def render_tool_descriptions(tools):
    """
    Converts a list of StructuredTool objects into a string 
    that describes their names, descriptions, and arguments.
    """
    description_lines = []
    for tool in tools:
        # Get basic info
        line = f"- **{tool.name}**: {tool.description}"
        
        # Optional: Add argument info if you want the planner to be really smart
        if tool.args:
             args_str = ", ".join(tool.args.keys())
             line += f" (Arguments: {args_str})"
             
        description_lines.append(line)
    
    return "\n".join(description_lines)
```

#### Step 3: Inject it in the Planner Node

Update your `plan_step` function in `graph.py` to generate this string and pass it to the prompt.

```
# graph.py

async def plan_step(state: GraphState):
    # ... (setup code) ...
    
    # 1. Get the tools list (assuming 'tools' is available in this scope, 
    #    or passed via a partial function if defined outside)
    #    (In your create_reasoning_engine, 'tools' is defined at the top)
    
    tool_desc_str = render_tool_descriptions(tools)
    
    # 2. Invoke with the dynamic string
    planner_chain = planner_prompt | llm
    response = await planner_chain.ainvoke({
        "history": history,
        "input": state["transcribed_text"],
        "tool_descriptions": tool_desc_str  # <--- INJECTED HERE
    })
    
    return {"plan": response.content}
```

### Summary

*   **StructuredTool.from\_function**: Tells the **Agent** _how_ to format the inputs (JSON Schema).
*   **Prompt Description**: Tells the **Planner** _when_ and _why_ to use the tool.
*   **Automation**: By rendering the descriptions dynamically, you get the best of both worlds: single source of truth (your python code) and rich context for the 8B model.



---
Powered by [Gemini Exporter](https://www.geminiexporter.com)