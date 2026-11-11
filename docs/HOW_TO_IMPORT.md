# Deliverables ko Miro, Jira aur draw.io mein kaise daalein (easy guide)

## 1. Miro board (research, user journeys, wireframes, system flow)

Files: `docs/miro/MIRO_BOARD.md`, `docs/miro/miro_stickies.csv`, `docs/miro/images/*.png`, `docs/architecture/architecture.png`

1. **miro.com** kholein → free account se login → **+ Create new** → **Blank board**. Naam: `AI Stock Market Assistant`.
2. Bayen toolbar se **Frame** tool (`F` key) chun kar 4 bade frames banayein, naam rakhein:
   `1 Research`, `2 User journeys`, `3 Wireframes`, `4 System flow`.
3. **Sticky notes:** `miro_stickies.csv` ko Excel mein kholein. Ek column (masalan "1 Research") ke saare cells select karke **Ctrl+C** karein → Miro mein us frame ke andar click karke **Ctrl+V** karein. Har cell ek alag sticky note ban jayega. Baqi 3 columns ke sath bhi yahi karein.
4. **Images:** `docs/miro/images/` folder kholein aur images ko drag karke frames mein chhod dein:
   - Frame 2: `journey.png`, `journey2.png`
   - Frame 3: `wireframe_chat.png`, `wireframe_technicals.png`, `wireframe_jobs.png`
   - Frame 4: `system_flow.png`, `job_flow.png`, `docs/architecture/architecture.png`
5. **Tables/text:** `MIRO_BOARD.md` se personas aur competitor table ka text copy karke **Text** tool (`T`) se frame 1 mein paste karein.
6. Upar dayen **Share** → "Anyone with the link can view" → link copy karke sir ko bhej dein.

## 2. Jira board (epics, stories, tasks, owners, acceptance criteria)

File: `docs/jira/jira_import.csv` (8 epics, 18 stories, 20 tasks)

1. **atlassian.com/software/jira** → **Get it free** → login.
2. **Create project** → **Scrum** → **Company-managed** chunein. Naam: `AI Stock Assistant`, key: `ASA`.
3. Upar **⚙ Settings (gear)** → **System** → bayen **External System Import** → **CSV**.
   (Agar ye na mile: upar search mein "Import issues from CSV" likhein.)
4. **Choose file** → `jira_import.csv` → **Next** → project `AI Stock Assistant` chunein → **Next**.
5. **Map fields** screen par ye milayein:
   | CSV column | Jira field |
   |---|---|
   | Issue ID | Issue ID |
   | Parent | Parent ID |
   | Issue Type | Issue Type |
   | Summary | Summary |
   | Epic Name | Epic Name |
   | Description | Description |
   | Assignee | Assignee (agar aapka Jira naam match na kare to "Don't map") |
   | Priority | Priority |
   | Labels | Labels |
   | Story Points | Story point estimate |
   | Status | Status |
   | Owner, Acceptance Criteria | Don't map (ye Description mein pehle se likhe hain) |
6. **Next** → **Begin Import**. Phir **Board** aur **Timeline** khol kar epics aur stories dekhein.
7. Agar Assignee map nahi hua: board par issues select karke **Assign to me** kar dein.

## 3. AWS-style architecture diagram (draw.io)

Files: `docs/architecture/architecture.drawio` (AWS icons ke sath), `architecture.png`, `architecture.mmd`

1. **app.diagrams.net** kholein → **Device** chunein (save ki jagah).
2. **Open Existing Diagram** → `architecture.drawio` chunein.
3. Diagram mein AWS ke asli icons hain: CloudFront, S3, ALB, Fargate, ElastiCache, Secrets Manager, CloudWatch, ECR.
   Kisi box ko hilana ho to drag karein. Teer (arrows) saath mein hilenge.
4. Image chahiye to **File → Export as → PNG** (zoom 200%).

## 4. Presentation

File: `docs/presentation/AI_Stock_Market_Assistant.pptx`
PowerPoint mein kholein. Har slide ke neeche **Notes** mein bolne wala text likha hai (**View → Notes**).
Presenting ke waqt **Slide Show → Presenter View** use karein, taake notes sirf aapko nazar aayein.
