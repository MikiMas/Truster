require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const Mailjet = require("node-mailjet");
const admin = require("firebase-admin");

/* ---------------------------
   🔥 INICIALIZAR FIREBASE
----------------------------*/
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL
  }),
});

const db = admin.firestore();

/* ---------------------------
   ✉️ INICIALIZAR MAILJET
----------------------------*/
const mailjet = Mailjet.apiConnect(
  process.env.MJ_APIKEY_PUBLIC,
  process.env.MJ_APIKEY_PRIVATE
);

/* ---------------------------
   🚀 EXPRESS
----------------------------*/
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());


/* ---------------------------
   📧 FUNCIÓN PARA ENVIAR EMAIL
----------------------------*/
async function sendOrderEmail(order) {
  const html = `
  <div style="font-family: Arial, sans-serif; background:#f3f4f6; padding:40px;">
    <div style="
      max-width:600px;
      background:white;
      margin:0 auto;
      border-radius:10px;
      padding:30px;
      box-shadow:0 4px 16px rgba(0,0,0,0.1);
    ">
      <div style="text-align:center; margin-bottom:30px;">
        <h1 style="color:#2563eb; margin:0; font-size:28px;">📦 Nuevo pedido recibido</h1>
        <p style="color:#6b7280; font-size:14px; margin-top:10px;">
          Un cliente ha enviado una nueva solicitud de compra segura.
        </p>
      </div>

      <h2 style="font-size:20px; border-left:4px solid #2563eb; padding-left:10px;">Producto</h2>
      <table style="width:100%; margin-top:10px;">
        <tr><td style="padding:6px 0; color:#6b7280;">URL:</td><td><a href="${order.productUrl}" style="color:#2563eb;">${order.productUrl}</a></td></tr>
        <tr><td style="padding:6px 0; color:#6b7280;">Información extra:</td><td>${order.extraInfo || "Ninguna"}</td></tr>
      </table>

      <h2 style="font-size:20px; border-left:4px solid #2563eb; padding-left:10px; margin-top:30px;">Datos del cliente</h2>
      <table style="width:100%; margin-top:10px;">
        <tr><td style="padding:6px 0; color:#6b7280;">Nombre:</td><td>${order.fullName}</td></tr>
        <tr><td style="padding:6px 0; color:#6b7280;">DNI:</td><td>${order.dni || "No indicado"}</td></tr>
        <tr><td style="padding:6px 0; color:#6b7280;">Email:</td><td>${order.email}</td></tr>
        <tr><td style="padding:6px 0; color:#6b7280;">Teléfono:</td><td>${order.phone || "No indicado"}</td></tr>
      </table>

      <h2 style="font-size:20px; border-left:4px solid #2563eb; padding-left:10px; margin-top:30px;">Dirección de envío</h2>
      <table style="width:100%; margin-top:10px;">
        <tr><td style="padding:6px 0; color:#6b7280;">Dirección:</td><td>${order.addressLine1}</td></tr>
        <tr><td style="padding:6px 0; color:#6b7280;">Info adicional:</td><td>${order.addressLine2 || "Ninguna"}</td></tr>
        <tr><td style="padding:6px 0; color:#6b7280;">Ciudad:</td><td>${order.city}</td></tr>
        <tr><td style="padding:6px 0; color:#6b7280;">Código postal:</td><td>${order.postalCode}</td></tr>
        <tr><td style="padding:6px 0; color:#6b7280;">Provincia:</td><td>${order.province || "No indicada"}</td></tr>
      </table>

      <h2 style="font-size:20px; border-left:4px solid #2563eb; padding-left:10px; margin-top:30px;">Notas adicionales</h2>
      <div style="background:#f9fafb; padding:15px; border-radius:6px;">
        ${order.notes || "El cliente no ha añadido notas."}
      </div>

      <p style="text-align:center; color:#9ca3af; font-size:12px; margin-top:40px;">
        Pedido recibido el ${new Date().toLocaleString()}
      </p>
    </div>
  </div>
  `;

  await mailjet.post("send", { version: "v3.1" }).request({
    Messages: [
      {
        From: { Email: "mikimas.business@gmail.com", Name: "Truster" },
        To: [{ Email: process.env.EMAIL_RECEIVER }],
        Subject: `Nuevo pedido recibido (#${order.id})`,
        HTMLPart: html
      }
    ]
  });
}


/* ---------------------------
   🟢 CREAR PEDIDO
----------------------------*/
app.post("/api/orders", async (req, res) => {
  try {
    const o = req.body;

    if (!o.productUrl || !o.fullName || !o.email)
      return res.status(400).json({ ok: false, message: "Faltan campos obligatorios" });

    const order = {
      id: Date.now(),
      ...o,
      createdAt: new Date().toISOString()
    };

    // Guardar en Firestore
    await db.collection("orders").doc(order.id.toString()).set(order);

    // Enviar email interno
    await sendOrderEmail(order);

    return res.json({ ok: true, message: "Solicitud recibida correctamente." });

  } catch (e) {
    console.log("❌ Error:", e);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
});


/* ---------------------------
   📄 LISTAR PEDIDOS
----------------------------*/
app.get("/api/orders", async (req, res) => {
  const snapshot = await db.collection("orders").get();
  const orders = snapshot.docs.map(doc => doc.data());
  res.json({ ok: true, orders });
});


/* ---------------------------
   🚀 INICIAR SERVIDOR
----------------------------*/
app.listen(PORT, () => {
  console.log(`Servidor funcionando en puerto ${PORT}`);
});
