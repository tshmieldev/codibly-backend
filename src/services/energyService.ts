import { addDays } from "date-fns";
import {
    type ApiResponse,
    type GenerationData,
    type DailyEnergyMix,
    type OptimalChargingWindow,
    CLEAN_ENERGY_SOURCES,
} from "../types";

const API_BASE_URL = "https://api.carbonintensity.org.uk/generation";

async function fetchGenerationData(
    from: Date,
    to: Date,
): Promise<GenerationData[]> {
    const fromStr = from.toISOString();
    const toStr = to.toISOString();
    const url = `${API_BASE_URL}/${fromStr}/${toStr}`;

    console.log(`Fetching data from ${url}`);

    const response = await fetch(url, {
        headers: {
            Accept: "application/json",
        },
    });

    if (!response.ok) {
        throw new Error(
            `Failed to fetch data from API: ${response.statusText}`,
        );
    }

    const json = (await response.json()) as ApiResponse;
    return json.data;
}

function calculateCleanEnergyScore(
    mix: { fuel: string; perc: number }[],
): number {
    return mix.reduce((acc, item) => {
        if (CLEAN_ENERGY_SOURCES.includes(item.fuel)) {
            return acc + item.perc;
        }
        return acc;
    }, 0);
}

export async function getEnergyMix(): Promise<DailyEnergyMix[]> {
    // Fetch 3 days of data (Yesterday, Today, Tomorrow)
    const now = new Date();
    const yesterday = new Date(
        Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 30),
    );
    const dayAfterTomorrow = new Date(
        Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 2, 0, 0),
    );

    const data = await fetchGenerationData(yesterday, dayAfterTomorrow);

    // Group by date
    const groupedData: Record<string, GenerationData[]> = {};

    data.forEach((item) => {
        // Extract date
        const dateStr = item.from.split("T")[0];
        if (!groupedData[dateStr]) {
            groupedData[dateStr] = [];
        }
        groupedData[dateStr].push(item);
    });

    // Process days
    const result: DailyEnergyMix[] = Object.keys(groupedData)
        .sort()
        .map((date) => {
            const dayData = groupedData[date];
            const intervalsCount = dayData.length;

            // Sum fuel percentages
            const fuelSums: Record<string, number> = {};

            dayData.forEach((interval) => {
                interval.generationmix.forEach((mixItem) => {
                    fuelSums[mixItem.fuel] =
                        (fuelSums[mixItem.fuel] || 0) + mixItem.perc;
                });
            });

            // Calculate averages
            const mix: Record<string, number> = {};
            let cleanEnergySum = 0;

            Object.keys(fuelSums).forEach((fuel) => {
                const avg = fuelSums[fuel] / intervalsCount;
                mix[fuel] = parseFloat(avg.toFixed(2));

                if (CLEAN_ENERGY_SOURCES.includes(fuel)) {
                    cleanEnergySum += avg;
                }
            });

            return {
                date,
                cleanEnergyPerc: parseFloat(cleanEnergySum.toFixed(2)),
                mix,
            };
        });

    // Return first 3 days
    return result.slice(0, 3);
}

export async function calculateOptimalChargingWindow(
    durationHours: number,
): Promise<OptimalChargingWindow> {
    // Fetch next 48 hours
    const now = new Date();
    const from = now;
    const to = addDays(now, 2);

    const data = await fetchGenerationData(from, to);

    // 30 min intervals
    const intervalsNeeded = durationHours * 2;

    if (data.length < intervalsNeeded) {
        throw new Error(
            "Not enough data available to calculate optimal window",
        );
    }

    let bestWindow: OptimalChargingWindow | null = null;
    let maxCleanEnergyAvg = -1;

    // Sliding window
    for (let i = 0; i <= data.length - intervalsNeeded; i++) {
        const windowSlice = data.slice(i, i + intervalsNeeded);

        let windowCleanEnergySum = 0;

        windowSlice.forEach((interval) => {
            const cleanScore = calculateCleanEnergyScore(
                interval.generationmix,
            );
            windowCleanEnergySum += cleanScore;
        });

        const avgCleanEnergy = windowCleanEnergySum / intervalsNeeded;

        if (avgCleanEnergy > maxCleanEnergyAvg) {
            maxCleanEnergyAvg = avgCleanEnergy;

            const firstInterval = windowSlice[0];
            const lastInterval = windowSlice[windowSlice.length - 1];

            bestWindow = {
                startTime: firstInterval.from,
                endTime: lastInterval.to,
                cleanEnergyPerc: parseFloat(avgCleanEnergy.toFixed(2)),
            };
        }
    }

    if (!bestWindow) {
        throw new Error("Could not calculate optimal window");
    }

    return bestWindow;
}
