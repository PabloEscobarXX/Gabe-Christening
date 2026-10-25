# Christening Invitation — Searchable Guest List + Google Sheets RSVP

This version already includes the baby photo on the first page. The image file is stored at `images/baby.jpg`. Replacing that image later will only change the front-page design and will **not** affect the RSVP logic, Apps Script, or Google Sheets data.


This version lets invited guests **search for their name first**. They can only RSVP after selecting a name that exists in your Google Sheet guest list.

## What the Google Sheet will contain

The Apps Script creates/uses two tabs:

### 1. Guest List

Columns:

- **Guest ID** — generated automatically; leave this blank when adding names
- **Guest Name** — this is where YOU enter all invited people
- **Attendance** — automatically updated by the website
- **Dietary Notes** — automatically updated by the website
- **Responded At** — automatically updated by the website

Example:

| Guest ID | Guest Name | Attendance | Dietary Notes | Responded At |
|---|---|---|---|---|
| *(automatic)* | Juan Dela Cruz | | | |
| *(automatic)* | Maria Santos | | | |
| *(automatic)* | Pedro Reyes | | | |

Only type/paste names into **column B (Guest Name)**. The website generates Guest IDs automatically the first time it searches.

### 2. RSVP Responses

This is the response history. Every submission is appended here, even if someone updates their response later.

## Setup

1. Create/open your Google Sheet.
2. Go to **Extensions > Apps Script**.
3. Replace the old Apps Script code with the new `google-apps-script.gs` from this project.
4. Click **Save**.
5. Return to your Google Sheet and create a tab named exactly **Guest List** if it does not exist yet.
6. In row 1 use these headers:
   - A1: `Guest ID`
   - B1: `Guest Name`
   - C1: `Attendance`
   - D1: `Dietary Notes`
   - E1: `Responded At`
7. Starting in **B2**, paste the names of everyone invited. Leave column A blank.

## Redeploy the updated Apps Script

Because this project changes the backend code, update your deployment:

1. Apps Script -> **Deploy > Manage deployments**.
2. Click the pencil/edit icon on your existing Web App deployment.
3. Under Version, choose **New version**.
4. Click **Deploy**.
5. Keep **Execute as: Me** and **Who has access: Anyone**.
6. Your existing `/exec` Web App URL can stay the same.

If you create a completely new deployment instead, paste the new `/exec` URL into `config.js`.

## Website behavior

1. Guest opens the invitation.
2. On RSVP page they type at least 2 letters of their name.
3. Matching names from your `Guest List` appear.
4. They select their exact name.
5. They choose **Joyfully attending** or **Unable to attend**.
6. They can optionally add dietary notes.
7. Their row in `Guest List` is updated.
8. A history entry is also added to `RSVP Responses`.

If a person already responded, the search result shows **Response on file**. They can select their name and submit again to update their answer.

## Search performance

Name search waits briefly for typing to pause, then searches a cached guest index instead of rereading the full sheet for every query. The index is refreshed when the Guest List is edited or an RSVP is submitted, and expires automatically after one minute.

## Files to publish on GitHub Pages

Upload:

- `index.html`
- `styles.css`
- `script.js`
- `config.js`

`google-apps-script.gs` stays in Google Apps Script and does not need to be hosted on GitHub.

## Important privacy note

The guest-name search is available to anyone who has your invitation link. It only returns matching names after at least 2 characters are typed, and it returns a maximum of 8 matches per search. Do not place sensitive information in the Guest List sheet—use names only.
