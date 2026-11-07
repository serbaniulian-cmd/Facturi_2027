// Rulează zilnic în GitHub Actions: trimite o notificare cu facturile neplătite scadente în max. 2 zile sau întârziate.
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });

const FURNIZORI = ["Curent", "Apă", "Gaz", "DIGI"], CASE = { p: "Părinți", n: "Noi" };
const ZILE_AVERTIZARE = 2;
const zi = n => n === 1 ? "1 zi" : `${n} zile`;

(async () => {
    const ref = admin.firestore().collection("facturi2027").doc(process.env.SYNC_COD);
    const snap = await ref.get();
    if (!snap.exists) return console.log("Documentul de sincronizare nu există.");
    const d = snap.data(), tokens = d.fcm || [];
    if (!tokens.length) return console.log("Niciun telefon înregistrat pentru notificări.");

    const azi = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Bucharest" }));
    azi.setHours(0, 0, 0, 0);

    const lista = [];
    for (const t of ["p", "n"]) for (let l = 0; l < 12; l++) for (let f = 0; f < 4; f++) {
        const scad = d[`${t}_scadenta_${l}_${f}`];
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(scad || "");
        if (!m || d[`${t}_status_${l}_${f}`]) continue;
        const z = Math.round((new Date(+m[1], +m[2] - 1, +m[3]) - azi) / 86400000);
        if (z > ZILE_AVERTIZARE) continue;
        const suma = d[`${t}_facturi_${l}_${f}`] || 0;
        const cand = z < 0 ? `întârziată ${zi(-z)}` : z === 0 ? "scade azi" : z === 1 ? "scade mâine" : `scade în ${zi(z)}`;
        lista.push({ z, txt: `${FURNIZORI[f]} (${CASE[t]}): ${cand}${suma > 0 ? " · " + suma.toFixed(2) + " lei" : ""}` });
    }
    if (!lista.length) return console.log("Nimic de notificat azi.");

    lista.sort((a, b) => a.z - b.z);
    const title = `${lista.length} ${lista.length === 1 ? "factură" : "facturi"} de plătit`;
    const body = lista.slice(0, 4).map(x => x.txt).join("\n") + (lista.length > 4 ? `\n+ încă ${lista.length - 4}` : "");

    const r = await admin.messaging().sendEachForMulticast({ tokens, data: { title, body }, webpush: { headers: { Urgency: "high" } } });
    console.log(`Trimise: ${r.successCount}, eșuate: ${r.failureCount}`);

    const moarte = tokens.filter((_, i) => !r.responses[i].success &&
        /not-registered|invalid-registration/.test(r.responses[i].error?.code || ""));
    if (moarte.length) await ref.update({ fcm: admin.firestore.FieldValue.arrayRemove(...moarte) });
})().catch(e => { console.error(e); process.exit(1); });
