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

/* GALLERY SYSTEM */

async function loadGallery() {

    const galleryContainer = document.getElementById("gallery-container");

    if (!galleryContainer) return;

    const params = new URLSearchParams(window.location.search);

    const category = params.get("category");

    document.getElementById("category-title").textContent =
        category.charAt(0).toUpperCase() + category.slice(1);

    const response = await fetch("gallery.json");

    const data = await response.json();

    const filtered = data.filter(item => item.category === category);

    filtered.forEach(item => {

        const div = document.createElement("div");

        div.className = "gallery-item";

        div.innerHTML = `

            <img src="${item.image}">

            <p>${item.caption}</p>

        `;

        galleryContainer.appendChild(div);

    });

}

loadGallery();