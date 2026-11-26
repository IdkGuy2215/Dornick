
// GPU performance chart

async function loadGPUChart() {
    const chart = document.getElementById("gpu-chart");
    const status = document.getElementById("chart-status");

    // Only run this code on pages containing the GPU chart.
    if (!chart) return;

    try {
        const response = await fetch("src/charts/gpu-data.csv");

        if (!response.ok) {
            throw new Error("Could not load GPU data.");
        }

        const csv = await response.text();
        const rows = parseCSV(csv);

        if (rows.length < 2) {
            throw new Error("The GPU data file contains no GPU entries.");
        }

        const headers = rows[0].map(header =>
            header.trim().toLowerCase()
        );

        const requiredColumns = [
            "name",
            "manufacturer",
            "generation",
            "score"
        ];

        for (const column of requiredColumns) {
            if (!headers.includes(column)) {
                throw new Error(`Missing CSV column: ${column}`);
            }
        }

        const column = name => headers.indexOf(name);

        const gpus = rows.slice(1)
            .filter(row => row.length >= headers.length)
            .map(row => ({
                name: row[column("name")].trim(),
                manufacturer: row[column("manufacturer")].trim(),
                generation: row[column("generation")].trim(),
                score: Number(row[column("score")])
            }))
            .filter(gpu =>
                gpu.name &&
                gpu.manufacturer &&
                Number.isFinite(gpu.score) &&
                gpu.score > 0
            );

        if (gpus.length === 0) {
            throw new Error("No valid GPU entries were found.");
        }

        // Sort GPUs from lowest to highest performance.
        gpus.sort((a, b) => a.score - b.score);

        // Manufacturer colors.
        const manufacturerColors = {
            "NVIDIA": "#76B900",
            "AMD": "#ED1C24",
            "Intel": "#0071C5"
        };

        // Fallback colors for other manufacturers.
        const fallbackColors = [
            "#713A91",
            "#E0A458",
            "#43A6A1",
            "#D47BA8",
            "#8C9EFF"
        ];

        const manufacturers = [
            ...new Set(gpus.map(gpu => gpu.manufacturer))
        ];

        const traces = manufacturers.map((manufacturer, index) => {
            const manufacturerGPUs = gpus.filter(
                gpu => gpu.manufacturer === manufacturer
            );

            return {
                x: manufacturerGPUs.map(gpu => gpu.name),
                y: manufacturerGPUs.map(gpu => gpu.score),

                type: "scatter",
                mode: "markers",
                name: manufacturer,

                marker: {
                    size: 9,
                    color: manufacturerColors[manufacturer] ||
                        fallbackColors[index % fallbackColors.length],
                    line: {
                        width: 0.5,
                        color: "#17121F"
                    }
                },

                customdata: manufacturerGPUs.map(gpu => [
                    gpu.generation,
                    gpu.manufacturer
                ]),

                hovertemplate:
                    "<b>%{x}</b><br>" +
                    "Performance score: %{y:,.0f}<br>" +
                    "Generation: %{customdata[0]}<br>" +
                    "Manufacturer: %{customdata[1]}" +
                    "<extra></extra>"
            };
        });

        const layout = {
            title: {
                text: "GPU Performance Comparison",
                font: {
                    color: "#F1EAF3",
                    size: 20
                }
            },

            paper_bgcolor: "#292033",
            plot_bgcolor: "#201A29",

            font: {
                color: "#F1EAF3"
            },

            xaxis: {
                title: "Graphics Card",
                type: "category",
                categoryorder: "array",
                categoryarray: gpus.map(gpu => gpu.name),
                gridcolor: "#493753",
                linecolor: "#65516F",
                automargin: true
            },

            yaxis: {
                title: "Performance Score",
                type: "linear",
                gridcolor: "#493753",
                linecolor: "#65516F",
                rangemode: "tozero"
            },

            legend: {
                title: {
                    text: "Manufacturer"
                },
                bgcolor: "#292033",
                bordercolor: "#493753",
                borderwidth: 1
            },

            hoverlabel: {
                bgcolor: "#17121F",
                bordercolor: "#713A91",
                font: {
                    color: "#F1EAF3"
                }
            },

            margin: {
                l: 75,
                r: 30,
                t: 70,
                b: 100
            },

            dragmode: "zoom"
        };

        const config = {
            responsive: true,
            scrollZoom: true,
            displaylogo: false,
            displayModeBar: true
        };

        await Plotly.newPlot(chart, traces, layout, config);

        status.textContent =
            `Loaded ${gpus.length} GPUs from ${manufacturers.length} manufacturers.`;

    } catch (error) {
        console.error("GPU chart error:", error);
        status.textContent = error.message;
    }
}


// Simple CSV parser that supports quoted fields and commas.
function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let insideQuotes = false;

    text = text.replace(/^\uFEFF/, "");

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"' && insideQuotes && next === '"') {
            field += '"';
            i++;
        } else if (char === '"') {
            insideQuotes = !insideQuotes;
        } else if (char === "," && !insideQuotes) {
            row.push(field);
            field = "";
        } else if ((char === "\n" || char === "\r") && !insideQuotes) {
            if (char === "\r" && next === "\n") {
                i++;
            }

            row.push(field);

            if (row.some(value => value.trim() !== "")) {
                rows.push(row);
            }

            row = [];
            field = "";
        } else {
            field += char;
        }
    }

    row.push(field);

    if (row.some(value => value.trim() !== "")) {
        rows.push(row);
    }

    return rows;
}


// Start loading the chart when the page is ready.
document.addEventListener("DOMContentLoaded", loadGPUChart);
