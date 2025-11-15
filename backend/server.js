require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const Stripe = require("stripe");
const Mailjet = require('node-mailjet');

// Mailjet API (NO SMTP)
const mailjet = Mailjet.apiConnect(
  process.env.MJ_APIKEY_PUBLIC,
  process.env.MJ_APIKEY_PRIVATE
);

// Función para enviar email interno
async function sendOrderEmail(order) {
  const html = `
    <h2>Nuevo pedido recibido</h2>
    <p><strong>Producto:</strong> ${order.productUrl}</p>
    <p><strong>Nombre:</strong> ${order.fullName}</p>
    <p><strong>Email:</strong> ${order.email}</p>
    <p><strong>Dirección:</strong> ${order.addressLine1}, ${order.city}</p>
    <p><strong>Notas:</strong> ${order.notes || "Sin notas"}</p>
  `;

  return mailjet
    .post("send", { version: "v3.1" })
    .request({
      Messages: [
        {
          From: {
            Email: "mikimas.business@gmail.com",
            Name: "Truster"
          },
          To: [
            {
              Email: process.env.EMAIL_RECEIVER,
              Name: "Truster Admin"
            }
          ],
          Subject: `Nuevo Pedido #${order.id}`,
          HTMLPart: html
        }
      ]
    });
}

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(bodyParser.json());

// Base de datos en memoria
let orders = [];
let orderId = 1;
const createId = () => orderId++;

// Crear pedido
app.post("/api/orders", async (req, res) => {
  try {
    const data = req.body;

    // Validación básica
    if (!data.productUrl || !data.fullName || !data.email || !data.addressLine1 || !data.city || !data.postalCode) {
      return res.status(400).json({ ok: false, message: "Faltan campos obligatorios" });
    }

    const order = {
      id: createId(),
      status: "pending_review",
      ...data,
      createdAt: new Date().toISOString()
    };

    orders.push(order);

    // Enviar email interno con Mailjet API (NO SMTP)
    await sendOrderEmail(order);

    return res.json({
      ok: true,
      message: "Solicitud recibida correctamente.",
      orderId: order.id
    });

  } catch (error) {
    console.error("Error al crear pedido:", error);
    return res.status(500).json({ ok: false, message: "Error interno del servidor." });
  }
});

// Listar pedidos
app.get("/api/orders", (req, res) => {
  res.json({ ok: true, orders });
});

app.listen(PORT, () => {
  console.log(`Backend funcionando en puerto ${PORT}`);
});
