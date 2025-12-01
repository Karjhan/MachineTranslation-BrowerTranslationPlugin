const fs = require("fs/promises")

const main = async() => {
    const file = await fs.readFile("./dist/manifest.json", "utf-8")
    const content = JSON.parse(file)
    content.content_scripts?.forEach(cs => delete cs.use_dynamic_url)
    content.web_accessible_resources?.forEach(war => delete war.use_dynamic_url)
    await fs.writeFile("./dist/manifest.json", JSON.stringify(content), "utf-8")
}

main()
