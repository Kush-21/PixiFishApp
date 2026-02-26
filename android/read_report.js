const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'build/reports/problems/problems-report.html'), 'utf-8');
const scriptMatch = html.match(/window\.model\s*=\s*(.*?);\n/);
if (scriptMatch) {
    try {
        const model = JSON.parse(scriptMatch[1]);
        model.problems.forEach(p => console.log(p.details?.details || p.details?.message || p.definition?.id?.displayName || JSON.stringify(p)));
    } catch (e) {
        console.error(e);
    }
} else {
    console.log("no JSON model found");
}
