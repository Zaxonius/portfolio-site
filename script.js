/* PAGE LOAD ANIMATION */

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
