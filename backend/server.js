require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const Mailjet = require("node-mailjet");

const mailjet = Mailjet.apiConnect(
  process.env.MJ_APIKEY_PUBLIC,
  process.env.MJ_APIKEY_PRIVATE
);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());

// BD en memoria
let orders = [];
let id = 1;
const createId = () => id++;

// Enviar email con Mailjet
async function sendOrderEmail(order) {
  const html = `
    <h2>Nuevo pedido recibido</h2>
    <p><strong>Producto:</strong> ${order.productUrl}</p>
    <p><strong>Cliente:</strong> ${order.fullName}</p>
    <p><strong>Email:</strong> ${order.email}</p>
    <p><strong>Ciudad:</strong> ${order.city}</p>
  `;

  await mailjet
    .post("send", { version: "v3.1" })
    .request({
      Messages: [{
        From: {
          Email: "mikimas.business@gmail.com",
          Name: "Truster"
        },
        To: [{ Email: process.env.EMAIL_RECEIVER }],
        Subject: "Nuevo pedido recibido",
        HTMLPart: html
      }]
    });
}

// Crear pedido
app.post("/api/orders", async (req, res) => {
  try {
    const o = req.body;

    if (!o.productUrl || !o.fullName || !o.email)
      return res.status(400).json({ ok: false, message: "Faltan campos obligatorios" });

    const order = { id: createId(), ...o, createdAt: new Date().toISOString() };
    orders.push(order);

    // Email interno
    await sendOrderEmail(order);

    return res.json({ ok: true, message: "Solicitud recibida correctamente." });

  } catch (e) {
    console.log("Error:", e);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
});

// Listar pedidos
app.get("/api/orders", (req, res) => {
  res.json({ ok: true, orders });
});

app.listen(PORT, () =>
  console.log(`Servidor funcionando en puerto ${PORT}`)
);
