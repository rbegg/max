I want to create some sample database for a neo4j database focused on a single user at a retirement home.  The data will include a list of the following node types:

- User Node: (also a person)  

- person nodes: (first name, last name, gender[M,F,X], date of birth, date of death, phone number, email, and notes)

- Support nodes: (also Persons, plus Title, Type)  types could be Family doctor, surgeon, nurse, PSW, etc.

- Daily-Events: (Day-of-Week [List of days of the week], StartTime, Duration, StartDate, EndDate)

- Appointments: (Date, Title, Start Time, Duration, Details)

- Locations: (Name, Address, Room, Type [e.g. Doctors office, hospital, community centre, theatre, store, private-residence, support-residence, etc.])

Generate example relationships for:

 - persons, generate a family of about 50 persons, including generations of ancestors, and two generations of descendants from the person who is also the user.  Include marriages, parents, partners, lives-with relationships.  Make sure the last names follow the family structure, with some changing their birth name and others who don't.

- also for persons, generate about 25 names of friends, with some additional sparse family relationships to friends. Example a user is friends with person p, p has-parent p2.

- for support persons,  define a provides-support relationship with user, generate past family doctors, a current family doctor, and example surgeon.  Also generate some nurses, personal support workers, case managers and receptionists for the location that the user is a resident.
- for daily events, generate attends relationships from User to event with a like rating between 0-5.  Include meals that are valid 7 days a week, and then a selective of plausible activities that only occur 1-7 times a week
- for appointments, generate a relationship Booked from User to appointment.  Create one appointment a week for 12 weeks in advance, include medical appointments, theatre shows, family dinners, personal care appoinrments.  All appointments should have Located-At relationship to a location.
- User should have a relationship Lives-At relationship to a location.
- Daily events should primarily have a relationship to the same location that user lives at.
Generate each node type in a csv file, include a header row, and integer row number as the id.
Generate a csv file for each relationshsip type, using the ids in the node csv files.