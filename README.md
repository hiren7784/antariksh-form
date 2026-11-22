# Antariksh Design Studio – Client requirement form

A short mobile form (English + Gujarati) that new clients fill before the first meeting.
On the last screen the form makes a PDF of the answers (studio logo, gold rules, page numbers).
The client taps **Send PDF to Antariksh on WhatsApp**: the phone's share sheet opens, the client
picks WhatsApp and the Antariksh chat (+91 76210 03444), and the PDF goes with a short message.
Where a browser cannot share files (most computers), the button downloads the PDF instead.
**Send as text message only** opens WhatsApp to +91 76210 03444 with all answers typed in.

Live link: https://hiren7784.github.io/antariksh-form/

- `index.html` – the whole form (styles and script inside)
- `img/logo.png` – studio logo shown in the header
- `img/og.png` – preview image WhatsApp shows with the link
- `img/icon.png`, `img/apple-touch-icon.png` – browser tab / home-screen icons
- `js/html2pdf.bundle.min.js` – html2pdf.js 0.14.0 (MIT), loaded only on the last screen to make the PDF; licences in `js/`

Answers stay in the client's browser until they send them; nothing is stored on a server.
