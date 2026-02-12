(function () {

  /* =============================
     ⚙️ CONFIG
  ============================== */

  const CONFIG = {
    id: "official_launch_2026",
    showOnce: true, // false للتجريب | true للإنتاج
    title: "تم الإطلاق الرسمي بنجاح",
    message:
      "نشكر ثقتكم، وسعدنا بالعمل معكم نتمنى لكم تجربة أكثر كفاءة واستقرارًا.\n"+
      "نتمنى لكم دوام التوفيق\n"+
      " مع تحيات X\n",
    primaryColor: "#2c7a7b"
  };

  if (CONFIG.showOnce && localStorage.getItem(CONFIG.id)) return;

  /* =============================
     🎨 Styles
  ============================== */

  const style = document.createElement("style");
  style.innerHTML = `
  @keyframes confettiFall {
    to {
      transform: translateY(110vh) rotate(720deg);
      opacity: 0;
    }
  }

  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.65);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    opacity: 0;
    transition: opacity 0.5s ease;
  }

  .modal {
    background: #ffffff;
    padding: 42px;
    border-radius: 22px;
    max-width: 500px;
    text-align: center;
    font-family: Cairo, sans-serif;
    transform: scale(0.9);
    transition: transform 0.6s cubic-bezier(.175,.885,.32,1.275);
  }

  .modal h2 {
    color: ${CONFIG.primaryColor};
    margin-bottom: 16px;
  }

  .modal p {
    color: #444;
    line-height: 1.8;
    white-space: pre-line;
  }

  .modal button {
    margin-top: 26px;
    padding: 12px 40px;
    font-size: 1rem;
    font-weight: bold;
    border-radius: 40px;
    border: none;
    cursor: pointer;
    background: ${CONFIG.primaryColor};
    color: #fff;
    box-shadow: 0 10px 20px rgba(44,122,123,0.35);
  }
  `;
  document.head.appendChild(style);

  /* =============================
     🎉 Confetti
  ============================== */

  function launchConfetti() {
    const count = 60;

    for (let i = 0; i < count; i++) {
      const piece = document.createElement("div");

      const size = Math.random() * 8 + 6;
      const left = Math.random() * 100;
      const delay = Math.random() * 0.3;
      const duration = Math.random() * 1.5 + 2;

      piece.style.cssText = `
        position: fixed;
        top: -10px;
        left: ${left}%;
        width: ${size}px;
        height: ${size * 0.6}px;
        background: hsl(${Math.random() * 360}, 80%, 60%);
        opacity: 0.9;
        transform: rotate(${Math.random() * 360}deg);
        animation: confettiFall ${duration}s ease-in ${delay}s forwards;
        z-index: 10000;
        pointer-events: none;
      `;

      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), (duration + delay) * 1000);
    }
  }

  /* =============================
     🚀 Start
  ============================== */

  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="modal">
      <h2>${CONFIG.title}</h2>
      <p>${CONFIG.message}</p>
      <button>متابعة</button>
    </div>
  `;

  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.style.opacity = "1";
    overlay.querySelector(".modal").style.transform = "scale(1)";
  });

  // 🎉 الزينة تظهر عند فتح الرسالة
  launchConfetti();

  overlay.querySelector("button").addEventListener("click", () => {
    overlay.style.opacity = "0";

    if (CONFIG.showOnce) {
      localStorage.setItem(CONFIG.id, "done");
    }

    setTimeout(() => overlay.remove(), 500);
  });

})();
