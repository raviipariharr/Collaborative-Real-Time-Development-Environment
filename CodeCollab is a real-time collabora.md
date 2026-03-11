**CodeCollab** is a real-time collaborative coding platform where multiple users can edit code together with role-based permissions, folder-level access control, and live communication using WebSockets.



Existing tools either focus only on real-time editing or only on file sharing. They don’t handle fine-grained permissions well, especially when multiple people collaborate on the same project.



One of the hardest parts was designing a three-level permission system so editors couldn’t accidentally modify restricted files.

**three-level permission system**- **At the project level** -roles like Owner, Admin, Editor, and Viewer define the user’s baseline capabilities.

**At the folder level**-  admins can override that baseline and grant edit access to specific folders.

**At the file level-** permissions are even more granular, especially for root files that aren’t inside any folder.





On the **backend**, I exposed REST APIs for authentication, project management, file operations, and permission checks.

Every write operation goes through a centralized permission validator to prevent unauthorized changes.



For **real-time collaboration**, I used WebSockets to sync code changes and presence across users while keeping the backend as the single source of truth.



On the **frontend**, I built a file explorer and code editor where permissions are enforced visually by switching files to read-only when access is missing.



**The Problem**

After updating permissions, the editor UI did not reflect changes instantly.

Root Cause

The permission state was cached on the frontend and not refreshed after permission updates.”

Fix

resolved this by re-fetching permission data on document selection and ensuring state updates triggered re-rendering.

Previously, the app likely loaded permissions once when it started and never checked again.

every time you click on or "select" a specific document, the app sends a quick request to the server

It stops relying on old information stored in the browser's memory.

