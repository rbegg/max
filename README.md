```
master-project/
├── .git/                      <-- The master Git repository
├── .gitmodules                <-- (If using submodules) File defining the sub-repos
│
├── services/                  <-- Directory containing your applications
│   ├── stt-app/               <-- Your current STT project lives here (as a sub-project)
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── ...
│   │
│   └── langchain-app/         <-- The new LangChain project (as another sub-project)
│       ├── src/
│       ├── Dockerfile
│       └── requirements.txt
│
├── proxy/                     <-- The reverse proxy configuration
│   ├── nginx/
│   │   ├── prod.conf
│   │   └── dev.conf
│   └── certs/
│       ├── cert.pem
│       └── key.pem
│
├── docker-compose.yaml        <-- The MASTER compose file that defines ALL services
├── docker-compose.dev.yaml    <-- Overrides for development
├── docker-compose.prod.yaml   <-- Overrides for production
└── Makefile                   <-- A master Makefile to control the whole system
```
