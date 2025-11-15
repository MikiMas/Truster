require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const Mailjet = require("node-mailjet");
const admin = require("firebase-admin");

/* ------------------------ FIREBASE ------------------------ */
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = admin.firestore();

/* ------------------------ MAILJET ------------------------ */
const mailjet = Mailjet.apiConnect(
  process.env.MJ_APIKEY_PUBLIC,
  process.env.MJ_APIKEY_PRIVATE
);

/* ------------------------ EXPRESS ------------------------ */
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());

/* ------------------------ UTILIDADES ------------------------ */
function generateOrderId() {
  // genera un número aleatorio de 10 dígitos SIN letras
  return Math.floor(1000000000 + Math.random() * 9000000000);
}

async function sendOrderEmail(order) {
  const html = `
    <div style="font-family: Arial; background:#f3f4f6; padding:40px;">
      <div style="max-width:600px; margin:auto; background:white; padding:30px; border-radius:10px;">
        <h2 style="color:#2563eb; margin-bottom:20px;">📦 Nuevo pedido recibido</h2>

        <h3 style="border-left:4px solid #2563eb; padding-left:8px;">Producto</h3>
        <p><strong>URL:</strong> <a href="${order.productUrl}">${order.productUrl}</a></p>
        <p><strong>Extra:</strong> ${order.extraInfo || "Ninguna"}</p>

        <h3 style="border-left:4px solid #2563eb; padding-left:8px; margin-top:25px;">Datos del cliente</h3>
        <p><strong>Nombre:</strong> ${order.fullName}</p>
        <p><strong>DNI:</strong> ${order.dni || "No indicado"}</p>
        <p><strong>Email:</strong> ${order.email}</p>
        <p><strong>Teléfono:</strong> ${order.phone || "No indicado"}</p>

        <h3 style="border-left:4px solid #2563eb; padding-left:8px; margin-top:25px;">Dirección</h3>
        <p>${order.addressLine1}</p>
        <p>${order.addressLine2 || ""}</p>
        <p>${order.postalCode} ${order.city} (${order.province || "Provincia no indicada"})</p>

        <h3 style="border-left:4px solid #2563eb; padding-left:8px; margin-top:25px;">Notas</h3>
        <p>${order.notes || "Sin notas"}</p>

        <p style="margin-top:40px; color:#777; font-size:12px;">
          Pedido creado el ${order.createdAt}
        </p>
      </div>
    </div>
  `;

  await mailjet
    .post("send", { version: "v3.1" })
    .request({
      Messages: [
        {
          From: {
            Email: "mikimas.business@gmail.com",
            Name: "Truster",
          },
          To: [{ Email: process.env.EMAIL_RECEIVER }],
          Subject: `Nuevo pedido (#${order.orderId})`,
          HTMLPart: html,
        },
      ],
    });
}

/* ------------------------ API: CREAR PEDIDO ------------------------ */
app.post("/api/orders", async (req, res) => {
  try {
    const o = req.body;

    // Validación básica
    if (!o.productUrl || !o.fullName || !o.email || !o.addressLine1 || !o.city || !o.postalCode) {
      return res.status(400).json({
        ok: false,
        message: "Faltan campos obligatorios",
      });
    }

    // Generamos ID + fecha
    const orderId = generateOrderId();
    const createdAt = new Date().toISOString();

    // Construimos pedido
    const order = {
      orderId,
      createdAt,
      productUrl: o.productUrl,
      extraInfo: o.extraInfo || "",
      fullName: o.fullName,
      dni: o.dni || "",
      email: o.email,
      phone: o.phone || "",
      addressLine1: o.addressLine1,
      addressLine2: o.addressLine2 || "",
      city: o.city,
      postalCode: o.postalCode,
      province: o.province || "",
      notes: o.notes || "",
    };

    // Guardar en Firestore
    await db.collection("orders").doc(orderId.toString()).set(order);

    // Enviar email de notificación
    await sendOrderEmail(order);

    return res.json({
      ok: true,
      message: "Solicitud recibida correctamente.",
      orderId,
    });
  } catch (err) {
    console.error("ERROR CREANDO PEDIDO:", err);
    return res.status(500).json({
      ok: false,
      message: "Error interno del servidor",
    });
  }
});

/* ------------------------ API: LISTAR PEDIDOS ------------------------ */
app.get("/api/orders", async (req, res) => {
  try {
    const snapshot = await db.collection("orders").orderBy("createdAt", "desc").get();
    const orders = snapshot.docs.map((doc) => doc.data());

    res.json({ ok: true, orders });
  } catch (err) {
    console.error("ERROR LISTANDO PEDIDOS:", err);
    res.status(500).json({ ok: false, message: "Error al obtener pedidos" });
  }
});

/* ------------------------ INICIO SERVIDOR ------------------------ */
app.listen(PORT, () =>
  console.log(`🚀 Servidor funcionando correctamente en puerto ${PORT}`)
);
