type AnyModule = Record<string, any>;

const firebaseConfig = {
  apiKey: "AIzaSyAKZMu2HZPmmoZ1fFT7DNA9Q6ystbKEPgE",
  authDomain: "samnanger-g14-f10a1.firebaseapp.com",
  projectId: "samnanger-g14-f10a1",
  storageBucket: "samnanger-g14-f10a1.firebasestorage.app",
  messagingSenderId: "926427862844",
  appId: "1:926427862844:web:5e6d11bb689c802d01b039",
  measurementId: "G-EJL3YYC63R",
};

export type CloudSdk = {
  app: any;
  auth: any;
  db: any;
  authApi: AnyModule;
  firestoreApi: AnyModule;
};

let cloudPromise: Promise<CloudSdk> | null = null;

function importRemote(url: string): Promise<AnyModule> {
  const dynamicImport = new Function("url", "return import(url)") as (url: string) => Promise<AnyModule>;
  return dynamicImport(url);
}

export function getCloudSdk(): Promise<CloudSdk> {
  if (cloudPromise) return cloudPromise;

  cloudPromise = Promise.all([
    importRemote("https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js"),
    importRemote("https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js"),
    importRemote("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js"),
  ]).then(([appApi, authApi, firestoreApi]) => {
    const existing = appApi.getApps().find((candidate: any) => candidate.name === "taktikktavle-cloud");
    const app = existing || appApi.initializeApp(firebaseConfig, "taktikktavle-cloud");
    const auth = authApi.getAuth(app);
    const db = firestoreApi.getFirestore(app);
    return { app, auth, db, authApi, firestoreApi };
  });

  return cloudPromise;
}
