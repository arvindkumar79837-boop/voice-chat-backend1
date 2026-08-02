# 🚀 Arvind Party Backend - Setup Guide (Hinglish Version)

## 🎯 Overview

Yeh guide aapko Arvind Party backend server ko local machine pe setup karne aur production ke liye ready karne mein help karegi. Isme project ka architecture, `.env` file ki saari variables, aur deployment flow samjhaya gaya hai.

---

## 🏗️ Core System Architecture

Aapka backend system several core components se milkar bana hai jo alag-alag kaam karte hain:

### 1. **Node.js / Express.js (Main Server)**
-   Yeh hamara main application server hai jo Express.js framework par bana hai.
-   Saare API requests (REST APIs) yahi handle karta hai.
-   Authentication, business logic, aur database communication ka center point hai.

### 2. **MongoDB Atlas (Main Database)**
-   **Purpose**: Yeh aapka primary database hai. Saara persistent data jaise user profiles, rooms, gifts, family details, etc. yahaan "collections" mein store hota hai.
-   **Kaise Use Hota Hai**: `mongoose` library ke through app MongoDB se connect karti hai. `src/models` directory mein aapke saare data schemas (e.g., `User.js`, `Room.js`) defined hain, jo database mein data ka structure batate hain. Production ke liye aapko MongoDB Atlas (cloud version) use karna chahiye.

### 3. **Redis (Caching & Real-time Messaging)**
-   **Purpose**: Redis ek in-memory database hai jo speed ke liye use hota hai.
-   **Kaise Use Hota Hai**:
    1.  **Caching**: Jo data baar-baar database se fetch karna padta hai (jaise user levels, settings), use Redis mein cache kiya jaata hai taaki response time fast ho.
    2.  **Socket.IO Adapter**: Production mein jab aapke server ke multiple instances (multiple servers) chalenge, toh Socket.IO ko un sabke beech real-time messages sync karne ke liye ek central system chahiye. Redis yahaan "Pub/Sub" mechanism ke through saare socket servers ko connect karta hai. Iske bina, ek server pe bheja gaya message doosre server ke users ko nahi milega.

### 4. **Socket.IO & LiveKit (Real-time Communication)**
-   **Purpose**: Yeh dono real-time features ke liye use hote hain, khaaskar voice rooms.
-   **Kaise Use Hota Hai**:
    -   **Socket.IO**: Text chat, gifts bhejna, likes, aur dusre non-audio real-time events ke liye use hota hai. Har user app kholne par ek WebSocket connection banata hai.
    -   **LiveKit**: Yeh specifically high-quality, low-latency voice chat rooms ke liye hai. Jab koi user voice room join karta hai, toh backend ek special `AccessToken` generate karke deta hai. User us token ko use karke seedha LiveKit ke cloud server se connect hota hai. Isse voice traffic aapke main Node.js server par load nahi daalta.

### 5. **Firebase (Authentication)**
-   **Purpose**: User login aur sign-up ko handle karne ke liye use hota hai.
-   **Kaise Use Hota Hai**:
    1.  Mobile app (Flutter) Firebase SDK ka use karke user ko authenticate karti hai (e.g., Google Sign-In, Apple Sign-In).
    2.  Authentication successful hone par Firebase ek `IdToken` deta hai.
    3.  Mobile app woh `IdToken` aapke Node.js backend ko `/auth/firebase-login` jaise endpoint par bhejti hai.
    4.  Backend `firebase-admin` SDK se us token ko verify karta hai.
    5.  Verify hone ke baad, backend apna khud ka system-specific token (`JWT_SECRET` se bana hua Access Token aur Refresh Token) generate karke mobile app ko deta hai.
    6.  Future ke saare API requests ke liye mobile app yahi JWT Access Token use karti hai. Isse authentication Firebase par rehta hai, lekin authorization aapke control mein.

---

## 🔑 `.env` Variable Breakdown

Yeh aapki `.env.example` file ka complete breakdown hai. Production setup ke liye in sabko `.env` file bana kar usme daalna zaroori hai.

### **MANDATORY** - Inke bina app chalegi hi nahi

| Variable               | Purpose                                                                                                                                | Active/Required? | Where to Get It                                                                                                                                                                                                                                                                   | Production Value Example                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `NODE_ENV`             | Application ka environment batata hai. `development` mein debugging features on rehte hain, `production` mein performance optimizations. | **Required**     | Isko `production` set karna hai live server pe.                                                                                                                                                                                                                                   | `production`                                                            |
| `PORT`                 | Aapka Node.js server kis network port par chalega.                                                                                     | **Required**     | Usually cloud providers (like Render, Heroku) isse automatically set karte hain. Local pe `5000` ya `8080` use kar sakte hain.                                                                                                                                                  | `5000`                                                                  |
| `MONGO_URI`            | Aapke MongoDB database ka connection string.                                                                                           | **Required**     | **MongoDB Atlas** par free cluster banayein -> "Connect" -> "Connect your application" -> "Copy" the connection string. Username/password aur database name change karein.                                                                                                           | `mongodb+srv://user:pass@cluster0.abcde.mongodb.net/YourDatabaseName` |
| `JWT_SECRET`           | Access Tokens (15 min validity) ko sign karne ke liye secret key. Yeh aapke system ki main chaabi hai.                                 | **Required**     | Ek strong, random 256-bit string generate karein. [Use this link to generate one](https://www.grc.com/passwords.htm). Isse kabhi commit na karein.                                                                                                                                  | `aVeryStrong_Random_SECRET_string_!@#$1234`                               |
| `REFRESH_TOKEN_SECRET` | Refresh Tokens (30 days validity) ko sign karne ke liye secret key. Yeh `JWT_SECRET` se alag hona chahiye.                               | **Required**     | Same as `JWT_SECRET`, ek aur strong random string generate karein.                                                                                                                                                                                                                | `another_DIFFERENT_strong_Random_SECRET_!@#$5678`                         |

### **FIREBASE (MANDATORY)** - Authentication ke liye zaroori

| Variable                       | Purpose                                                                                                                             | Active/Required? | Where to Get It                                                                                                                                                                                                                                                         | Production Value Example                                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `FIREBASE_SERVICE_ACCOUNT`     | Backend ko Firebase project se connect karne ke liye service account JSON key. Isse backend user tokens verify kar paata hai.        | **Required**     | **Firebase Console** -> Project Settings -> Service accounts -> "Generate new private key". Aapko ek JSON file milegi. Uska poora content copy karke is variable mein paste kar dein (as a single line string) ya file ka path dein.                                              | `'{"type": "service_account", "project_id": "...", ...}'` (as a single line)                                                |
| `FIREBASE_DATABASE_URL`        | Firebase Realtime Database ka URL. `firebase-admin` SDK ko initialize karne ke liye zaroori hai.                                      | **Required**     | **Firebase Console** -> Realtime Database -> Aapko URL top par dikhega.                                                                                                                                                                                                   | `https://your-project-id-default-rtdb.firebaseio.com`                                                                     |

### **GOOGLE PLAY (MANDATORY)** - In-App Purchase verification ke liye

| Variable                             | Purpose                                                                                                   | Active/Required? | Where to Get It                                                                                                                                                                                                                                                                             | Production Value Example                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `GOOGLE_PLAY_PACKAGE_NAME`           | Aapke Android app ka package name.                                                                        | **Required**     | Aapki Flutter app ke `build.gradle` file mein `applicationId` se mil jaayega.                                                                                                                                                                                                               | `com.arvindparty.app`                                             |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Google Play Developer Console se In-App Purchase ko server-side verify karne ke liye service account JSON key. | **Required**     | **Google Cloud Console** -> APIs & Services -> Credentials -> Create Credentials -> Service Account. Phir **Google Play Console** -> Setup -> API access -> "Link" your Google Cloud project and "Grant access" to the service account for "Admin" permissions. JSON key generate karein. | `'{"type": "service_account", "project_id": "...", ...}'`         |

### **LIVEKIT (MANDATORY)** - Voice Rooms ke liye

| Variable             | Purpose                                                                                   | Active/Required? | Where to Get It                                                                                                                                                             | Production Value Example                          |
| -------------------- | ----------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `LIVEKIT_API_KEY`    | LiveKit server se connect karne ke liye API Key.                                          | **Required**     | **LiveKit Cloud Dashboard** (cloud.livekit.io) -> Project Settings -> "Create Key". Aapko API Key aur Secret milega.                                                          | `APIAbcdeF12345678`                               |
| `LIVEKIT_API_SECRET` | LiveKit server se connect karne ke liye API Secret.                                       | **Required**     | Same as above, Key ke saath milta hai.                                                                                                                                      | `aVeryLongSecretKeyForLiveKitAbcdef1234567890`      |
| `LIVEKIT_WS_URL`     | Aapke LiveKit server ka WebSocket URL. Mobile app ispar connect karti hai.                  | **Required**     | LiveKit Cloud Dashboard par project details mein mil jaayega.                                                                                                               | `wss://your-project-name.livekit.cloud`             |

### **REDIS** - Caching aur Scaling ke liye (Production mein zaroori)

| Variable         | Purpose                                                                                                       | Active/Required?      | Where to Get It                                                                                                                                                                                               | Production Value Example                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `REDIS_URL`      | Redis server ka connection URL. Isme host, port, password sab hota hai. Agar yeh hai, toh baaki Redis vars ignore ho jaate hain. | **Highly Recommended** | **Redis Cloud**, **Upstash**, ya kisi bhi cloud Redis provider par free/paid instance banayein. Wahan se connection URL mil jaayega.                                                                         | `redis://default:password@hostname:port`         |
| `REDIS_HOST`     | Sirf tab use hota hai jab `REDIS_URL` na ho.                                                                  | Optional (Fallback) | Cloud provider se mil jaayega.                                                                                                                                                                                | `c-1.redis-db.cloud.redislabs.com`             |
| `REDIS_PORT`     | Sirf tab use hota hai jab `REDIS_URL` na ho.                                                                  | Optional (Fallback) | Cloud provider se mil jaayega.                                                                                                                                                                                | `12345`                                        |
| `REDIS_PASSWORD` | Sirf tab use hota hai jab `REDIS_URL` na ho.                                                                  | Optional (Fallback) | Cloud provider se mil jaayega.                                                                                                                                                                                | `aStrongPasswordForRedis`                      |

### **OPTIONAL** - Features aur suvidha ke liye

| Variable                  | Purpose                                                                                                             | Active/Required? | Where to Get It                                                                                                                              | Production Value Example                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `CLOUDINARY_CLOUD_NAME`   | Agar `CDN_ENABLED=true` hai, toh Cloudinary par images/videos upload karne ke liye Cloud Name.                        | Optional         | **Cloudinary Dashboard** -> Aapka Cloud Name top par dikhega.                                                                                  | `your-cloud-name`                                                         |
| `CLOUDINARY_API_KEY`      | Cloudinary API Key.                                                                                                 | Optional         | Cloudinary Dashboard -> Settings -> Access Keys.                                                                                             | `123456789012345`                                                         |
| `CLOUDINARY_API_SECRET`   | Cloudinary API Secret.                                                                                              | Optional         | Same as above.                                                                                                                               | `aVeryLongSecretForKey`                                                   |
| `SENTRY_DSN`              | Production mein errors ko track karne ke liye Sentry ka DSN link. Highly recommended for live apps.                   | Optional         | **Sentry.io** par project banayein -> Settings -> Client Keys (DSN).                                                                         | `https://abcdef1234567890@o12345.ingest.sentry.io/67890`                   |
| `SMTP_HOST`               | Email bhejne ke liye SMTP server address (e.g., password reset, alerts).                                            | Optional         | **SendGrid**, **Brevo (Sendinblue)**, ya **Amazon SES** jaise service provider se mil jaayega.                                               | `smtp.sendgrid.net`                                                       |
| `SMTP_USER` / `SMTP_PASS` | SMTP server ka username aur password/API Key.                                                                       | Optional         | Same email service provider se.                                                                                                              | `apikey` / `SG.abcde...`                                                  |
| `OPENAI_API_KEY`          | AI features ke liye (jaise error resolution). Agar use nahi kar rahe toh chhod dein.                                  | Optional         | **OpenAI Platform** (platform.openai.com) -> API keys.                                                                                       | `sk-abcdef1234567890`                                                     |
| `APP_BASE_URL`            | Aapke deployed backend server ka main URL. Kuch background tasks ya webhooks mein use ho sakta hai.                   | Optional         | Jab aap server deploy karenge, toh jo URL milega woh yahaan daalna hai.                                                                       | `https://your-backend.onrender.com`                                       |

---

## 🚀 Deployment & URL Mapping

Jab aap is backend repository ko **Render**, **Heroku**, ya kisi server par deploy karte hain, toh woh aapko ek live URL dega. Maan lijiye woh URL hai: `https://arvind-party-backend.onrender.com`.

Ab, aapke Mobile App aur Web Panel ko is server se connect karne ke liye is URL ko use karna padega.

### 1. **Mobile App (Flutter) Connection**

Aapki Flutter app mein ek config ya environment file hogi (e.g., `.env`, `lib/config.dart`). Wahan aapko do variables update karne honge:

-   **`API_BASE_URL`**: Yeh REST API calls ke liye use hoga.
    ```dart
    // Example in Flutter
    const String API_BASE_URL = 'https://arvind-party-backend.onrender.com/api';
    ```

-   **`SOCKET_URL`**: Yeh real-time Socket.IO connection ke liye use hoga.
    ```dart
    // Example in Flutter
    const String SOCKET_URL = 'https://arvind-party-backend.onrender.com';
    ```

### 2. **Admin / Web Panel Connection**

Same tareeke se, aapke Admin Panel (jo shayad React/Angular/Vue mein bana ho) mein bhi ek `.env` file ya config file hogi jahan aapko backend URL daalna hoga.

-   **`REACT_APP_API_URL`** (for React):
    ```
    REACT_APP_API_URL=https://arvind-party-backend.onrender.com/api
    ```
-   **`REACT_APP_SOCKET_URL`**:
    ```
    REACT_APP_SOCKET_URL=https://arvind-party-backend.onrender.com
    ```

### **Important Consideration: CORS**

-   **Seamless Communication**: Haan, aapka mobile app aur web panel dono same backend, same database, aur same socket server se flawlessly communicate karenge, agar sahi se configure kiya ho.
-   **CORS (Cross-Origin Resource Sharing)**: Aapka backend server by default kisi unknown domain (jaise aapka admin panel ka URL) se aane waali API requests ko block kar dega. Isse bachne ke liye aapko `src/app.js` ya `src/config/cors.js` mein apne admin panel ka domain "whitelist" karna hoga.

    **Example (`app.js` mein):**
    ```javascript
    const cors = require('cors');

    const allowedOrigins = [
      'http://localhost:3001', // Local admin panel
      'https://admin.arvindparty.com' // Production admin panel URL
    ];

    app.use(cors({
      origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    }));
    ```
    Isse aapka backend sirf aapke web panel se aane waale requests ko hi allow karega. Mobile apps ko CORS issue nahi hota.

---

Aapka setup ab complete hai! In steps ko follow karke aap server ko local par chala sakte hain aur production ke liye bhi prepare kar sakte hain.
