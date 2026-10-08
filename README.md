# StudyCircle - Student Notes Sharing
**Stack:** HTML, CSS, JavaScript, Bootstrap 5, Node.js (Express), MongoDB (Mongoose), Multer (file upload)

## Run
1. Install Node.js and MongoDB Community Server (start MongoDB). Or use MongoDB Atlas and set `MONGO_URI`.
2. In this folder: `npm install` then `npm start`
3. Open http://localhost:3000

Uploaded files are saved in the `uploads` folder (created automatically).

## Features
- Student: upload notes (PDF, Word, PowerPoint, text, up to 5 MB), search by title, subject or semester, download, rate 1 to 5 stars (rating again updates your rating), see own uploads and their status
- Admin: sees notes waiting for approval, checks the file, approves or rejects, sees totals
- Only approved notes are visible to other students; you cannot rate your own note

## Collections
- users: name, email (unique), password (hash), role (student / admin)
- notes: uploader (ref), title, subject, semester, description, fileName, originalName, status (pending / approved), downloads, ratings [ {user, stars} ]

## Viva points
- Multer handles `multipart/form-data`; files get a random name on the server so two files never clash, and the original name is used when downloading.
- Ratings are stored as an array inside each note document (embedded documents), a MongoDB strength compared to a separate table.
- Average rating is calculated when notes are read.
- Demo note: registration lets you pick the admin role for easy demonstration.
- Future scope: preview before download, comments, report-abuse button, email alerts for new notes.
