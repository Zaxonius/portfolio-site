const fs = require("fs-extra");
const matter = require("gray-matter");
const path = require("path");

const galleryDir = path.join(__dirname, "../content/gallery");

const outputFile = path.join(__dirname, "../gallery.json");

async function generateGallery() {

    const files = await fs.readdir(galleryDir);

    const images = [];

    for (const file of files) {

        if (!file.endsWith(".md")) continue;

        const filePath = path.join(galleryDir, file);

        const content = await fs.readFile(filePath, "utf8");

        const { data } = matter(content);

        images.push({
            image: data.image,
            caption: data.caption,
            category: data.category
        });
    }

    await fs.writeJson(outputFile, { images }, { spaces: 2 });

    console.log("gallery.json generated");

}

generateGallery();