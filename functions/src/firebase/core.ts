const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert({
    "type": "service_account",
    "project_id": "primo-d4041",
    "private_key_id": functions.config().fb.keyid.replace(/\\n/g, '\n'),
    "private_key": functions.config().fb.key.replace(/\\n/g, '\n'),
    "client_email": "firebase-adminsdk-e5sj0@primo-d4041.iam.gserviceaccount.com",
    "client_id": "106436721939794055537",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-e5sj0%40primo-d4041.iam.gserviceaccount.com"
  })
});

export const db = admin.firestore();
export const auth = admin.auth()