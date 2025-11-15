const API_URL = "https://truster-24lr.onrender.com/api/orders";

const form = document.getElementById("orderForm");
const messageEl = document.getElementById("message");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  messageEl.textContent = "";
  messageEl.className = "message";

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.message || "Error al enviar la solicitud.");
    }

    messageEl.textContent = "Solicitud enviada correctamente.";
    messageEl.classList.add("success");
    form.reset();
  } catch (error) {
    messageEl.textContent = error.message || "Ha ocurrido un error.";
    messageEl.classList.add("error");
  }
});
