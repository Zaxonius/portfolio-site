async function compressImage(file, maxWidth = 1000, quality = 0.85) {
  return new Promise((resolve) => {
    const img = document.createElement("img");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const reader = new FileReader();

    reader.onload = function (e) {
      img.src = e.target.result;
    };

    img.onload = function () {

      const scale = maxWidth / img.width;

      canvas.width = maxWidth;
      canvas.height = img.height * scale;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        resolve(blob);
      }, "image/jpeg", quality);
    };

    reader.readAsDataURL(file);
  });
}

/* PAGE LOAD */

window.addEventListener("load", () => {
    document.body.classList.add("fade-in");
});

/* PAGE TRANSITIONS */

const links = document.querySelectorAll(".transition-link");

links.forEach(link => {
    link.addEventListener("click", e => {
        e.preventDefault();

        const target = link.href;

        document.body.classList.remove("fade-in");
        document.body.classList.add("fade-out");

        setTimeout(() => {
            window.location.href = target;
        }, 500);
    });
});

/* =========================
   SUPABASE CONFIG
========================= */

const SUPABASE_URL = "https://gzideerhgdpottfcisdu.supabase.co";
const SUPABASE_KEY = "sb_publishable_R_SzwLxuAvWtThANEDM2fw_2K8g85NZ";

/* =========================
   GALLERY SYSTEM (UPDATED)
========================= */

async function loadGallery() {

    const galleryContainer = document.getElementById("gallery-container");
    if (!galleryContainer) return;

    const params = new URLSearchParams(window.location.search);
    const category = params.get("category");

    if (!category) return;

    document.getElementById("category-title").textContent =
        category.charAt(0).toUpperCase() + category.slice(1);

    const response = await fetch(
        `${SUPABASE_URL}/rest/v1/photos?gallery=eq.${category}`,
        {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`
            }
        }
    );

    const data = await response.json();

    data.forEach(item => {

        const div = document.createElement("div");
        div.className = "gallery-item";

        div.innerHTML = `
            <img 
                src="${item.url.replace('/upload/', '/upload/w_500,q_auto,f_auto/')}" 
                alt="${item.description}"
                loading="lazy"
            />
            <p>${item.description || ""}</p>
        `;

        galleryContainer.appendChild(div);
    });
}

async function login() {

    const password = document.getElementById("passwordInput").value;

    const res = await fetch("https://photo-api.keytehipkins.workers.dev/admin-login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ password })
    });

    const data = await res.json();

    if (data.success) {
        document.getElementById("loginBox").style.display = "none";
        document.getElementById("adminPanel").style.display = "block";
    } else {
        alert("Wrong password");
    }
}

loadGallery();