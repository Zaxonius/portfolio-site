const chokidar = require("chokidar");
const { exec } = require("child_process");

console.log("Watching gallery content...");

chokidar.watch("./content/gallery").on("all", () => {

    exec("node scripts/generate-gallery.js", (err, stdout, stderr) => {

        if (err) {
            console.error(err);
            return;
        }

        console.log(stdout);
    });

});