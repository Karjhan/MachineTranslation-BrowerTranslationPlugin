const fs = require("fs/promises")

const main = async() => {
    try {
        const file = await fs.readFile("./dist/manifest.json", "utf-8")
        const content = JSON.parse(file)
        let exists = false
        content.content_scripts?.forEach(cs => {
            if(cs.use_dynamic_url) {
                delete cs.use_dynamic_url
                exists = true
            }
        })
        content.web_accessible_resources?.forEach(war => {
            if(war.use_dynamic_url) {
                delete war.use_dynamic_url
                exists = true
            }
        })
        if(exists) await fs.writeFile("./dist/manifest.json", JSON.stringify(content), "utf-8")
    } catch (error) {
        console.error(error)
    }
}

setInterval(() => main(), 1000)
