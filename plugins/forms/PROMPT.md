Build a contact form for this Primo site using the first-party Forms example.

Read plugins/forms/README.md and its reference block before editing. Customize
fields, labels, styling, and feedback to match the user's request and site.
Update form.json and the block together so their field names, types, required
flags, and length limits agree. Preserve the honeypot, pending state, accessible
labels, and request ID across retries of unchanged data.

Register the form with the site's authenticated forms endpoint. Use only the
public primo.forms.submit interface in the browser. Never put administrative
tokens, mail credentials, notification recipients, or direct database access in
a block. Do not add arbitrary server JavaScript. Configure a notification address
only when the site owner requests one. SMTP belongs to the server operator.

Install the block into the site's blocks directory without overwriting existing
work. Add it to the requested page using the site's existing page format. Test
successful submission, validation failure, retry, and the private submissions
inbox. Explain whether email delivery is configured. Do not claim email was sent
merely because the submission was accepted.
