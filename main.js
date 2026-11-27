
// GPU performance chart

async function loadGPUChart() {
    const chart = document.getElementById("gpu-chart");
    const status = document.getElementById("chart-status");

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
                gpu.generation &&
                Number.isFinite(gpu.score) &&
                gpu.score > 0
            );

        if (gpus.length === 0) {
            throw new Error("No valid GPU entries were found.");
        }

        // Preserve the generation order from the CSV.
        const generations = [
            ...new Set(gpus.map(gpu => gpu.generation))
        ];

        // Assign each generation its own X-axis position.
        const generationPositions = new Map(
            generations.map((generation, index) => [
                generation,
                index
            ])
        );

        // Calculate horizontal offsets for GPUs with scores
        // within 5 points of another GPU in the same generation.
        for (const generation of generations) {
            const group = gpus
                .filter(gpu => gpu.generation === generation)
                .sort((a, b) => a.score - b.score);

            const clusters = [];
            let cluster = [];

            for (const gpu of group) {
                if (
                    cluster.length === 0 ||
                    gpu.score - cluster[cluster.length - 1].score < 5
                ) {
                    cluster.push(gpu);
                } else {
                    clusters.push(cluster);
                    cluster = [gpu];
                }
            }

            if (cluster.length > 0) {
                clusters.push(cluster);
            }

            for (const cluster of clusters) {
                cluster.forEach((gpu, index) => {
                    gpu.x = generationPositions.get(generation);

                    if (cluster.length > 1) {
                        const spacing = 0.08;
                        gpu.x +=
                            (index - (cluster.length - 1) / 2) * spacing;
                    }
                });
            }
        }

        // Manufacturer colors.
        const manufacturerColors = {
            "NVIDIA": "#76B900",
            "AMD": "#ED1C24",
            "ATI": "#E87536",
            "Intel": "#0071C5"
        };

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
                x: manufacturerGPUs.map(gpu => gpu.x),
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
                    gpu.name,
                    gpu.generation,
                    gpu.score
                ]),

                hovertemplate:
                    "<b>%{customdata[0]}</b><br>" +
                    "Performance score: %{customdata[2]:,.0f}<br>" +
                    "Generation: %{customdata[1]}<br>" +
                    "Manufacturer: " + manufacturer +
                    "<extra></extra>"
            };
        });

        const layout = {
            title: {
                text: "GPU Relative Performance Comparison",
                font: {
                    color: "#F1EAF3",
                    size: 20
                }
            
            },

            annotations: [
        {
            text: "Overall relative performance in relation to a GeForce 210",
            xref: "paper",
            yref: "paper",
            x: 0.99,
            y: 0.99,
            xanchor: "right",
            yanchor: "top",
            showarrow: false,
            font: {
                size: 12,
                color: "#C8BBCF"
            },
            bgcolor: "#190035",
            bordercolor: "#493753",
            borderwidth: 1,
            borderpad: 5
        }
    ],



            paper_bgcolor: "#220048",
            plot_bgcolor: "#201A29",

            font: {
                color: "#F1EAF3"
            },

            xaxis: {
                title: "GPU Generation",
                tickmode: "array",
                tickvals: generations.map((generation, index) => index),
                ticktext: generations,
                gridcolor: "#493753",
                linecolor: "#65516F",
                zeroline: false,
                range: [-0.5, generations.length - 0.5]
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
                b: 120
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
            `Loaded ${gpus.length} GPUs from ${generations.length} generations.`;

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
        } else if (
            (char === "\n" || char === "\r") &&
            !insideQuotes
        ) {
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


//CPU CHART

async function loadCPUChart() {
    const chart = document.getElementById("cpu-chart");
    const status = document.getElementById("cpu-chart-status");

    if (!chart) return;

    try {
        const response = await fetch("src/charts/cpu-data.csv");

        if (!response.ok) {
            throw new Error("Could not load CPU data.");
        }

        const csv = await response.text();
        const rows = parseCSV(csv);

        const headers = rows[0].map(header =>
            header.trim().toLowerCase()
        );

        const column = name => headers.indexOf(name);

        const cpus = rows.slice(1)
            .map(row => ({
                name: row[column("name")].trim(),
                manufacturer: row[column("manufacturer")].trim(),
                generation: row[column("generation")].trim(),
                score: Number(row[column("score")])
            }))
            .filter(cpu =>
                cpu.name &&
                cpu.manufacturer &&
                cpu.generation &&
                Number.isFinite(cpu.score) &&
                cpu.score > 0
            );

        if (cpus.length === 0) {
            throw new Error("No valid CPU entries found.");
        }

        // Get the generations in CSV order.
        const generations = [
            ...new Set(cpus.map(cpu => cpu.generation))
        ];

        // Assign each generation an X-axis position.
        cpus.forEach(cpu => {
            cpu.x = generations.indexOf(cpu.generation);
        });

        // Manufacturer colors.
        const manufacturerColors = {
            "AMD": "#ED1C24",
            "Intel": "#0071C5",
            "Nvidia": "#00c51e"
        };

        const manufacturers = [
            ...new Set(cpus.map(cpu => cpu.manufacturer))
        ];

        const traces = manufacturers.map(manufacturer => {
            const manufacturerCPUs = cpus.filter(
                cpu => cpu.manufacturer === manufacturer
            );

            return {
                x: manufacturerCPUs.map(cpu => cpu.x),
                y: manufacturerCPUs.map(cpu => cpu.score),

                type: "scatter",
                mode: "markers",
                name: manufacturer,

                marker: {
                    size: 9,
                    color: manufacturerColors[manufacturer] || "#713A91"
                },

                customdata: manufacturerCPUs.map(cpu => [
                    cpu.name,
                    cpu.generation
                ]),

                hovertemplate:
                    "<b>%{customdata[0]}</b><br>" +
                    "Performance score: %{y:,.0f}<br>" +
                    "Generation: %{customdata[1]}<br>" +
                    "Manufacturer: " + manufacturer +
                    "<extra></extra>"
            };
        });

        const layout = {
            title: {
                text: "CPU Relative Performance Comparison",
                font: {
                    color: "#F1EAF3",
                    size: 20
                }
            },

        annotations: [
            {
                text: "Overall relative performance in relation to a Ryzen 3 1200",
                xref: "paper",
                yref: "paper",
                x: 0.99,
                y: 0.99,
                xanchor: "right",
                yanchor: "top",
                showarrow: false,
                font: {
                    size: 12,
                    color: "#C8BBCF"
                },
                bgcolor: "#190035",
                bordercolor: "#493753",
                borderwidth: 1,
                borderpad: 5
            }
        ],

            paper_bgcolor: "#220048",
            plot_bgcolor: "#201A29",

            font: {
                color: "#F1EAF3"
            },

            xaxis: {
                title: "CPU Generation",
                tickmode: "array",
                tickvals: generations.map((generation, index) => index),
                ticktext: generations,
                gridcolor: "#493753",
                linecolor: "#65516F"
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

            margin: {
                l: 75,
                r: 30,
                t: 70,
                b: 120
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
            `Loaded ${cpus.length} CPUs from ${generations.length} generations.`;

    } catch (error) {
        console.error("CPU chart error:", error);
        status.textContent = error.message;
    }
}


// Start loading the chart when the page is ready.
document.addEventListener("DOMContentLoaded", () => {
    loadGPUChart();
    loadCPUChart();
});