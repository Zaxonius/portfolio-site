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

loadGallery();