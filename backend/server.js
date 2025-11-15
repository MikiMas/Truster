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
  const excludedFields = ["id", "status", "createdAt"]; 

  const rows = Object.entries(order)
    .filter(([key]) => !excludedFields.includes(key))
    .map(([key, value]) => {
      const label = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, c => c.toUpperCase());

      return `
        <tr>
          <td style="padding: 6px 10px; border-bottom: 1px solid #eee; font-weight: 600; white-space: nowrap;">${label}</td>
          <td style="padding: 6px 10px; border-bottom: 1px solid #eee;">${value || "-"}</td>
        </tr>`;
    })
    .join("");

  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; background: #f9fafb; padding: 24px;">
      <h2 style="margin: 0 0 12px; font-size: 20px;">Nuevo pedido recibido</h2>
      <p style="margin: 0 0 20px; font-size: 14px; color: #4b5563;">
        Se ha recibido una nueva solicitud desde el formulario de Truster.
      </p>
      <table style="border-collapse: collapse; width: 100%; max-width: 640px; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);">
        <tbody>
          ${rows}
        </tbody>
      </table>
      <p style="margin: 16px 0 0; font-size: 12px; color: #9ca3af;">
        Pedido #${order.id} · ${order.createdAt ? new Date(order.createdAt).toLocaleString() : ""}
      </p>
    </div>
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
