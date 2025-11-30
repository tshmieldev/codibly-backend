import {
    describe,
    expect,
    test,
    spyOn,
    beforeAll,
    afterAll,
    beforeEach,
} from "bun:test";
import { getEnergyMix, calculateOptimalChargingWindow } from "./energyService";
import { addDays, startOfDay } from "date-fns";

// Mock helper
const createMockGenerationData = (startDate: Date, days: number) => {
    const data = [];
    const totalIntervals = days * 48; // 48 intervals/day

    for (let i = 0; i < totalIntervals; i++) {
        const time = new Date(startDate.getTime() + i * 30 * 60 * 1000);
        const toTime = new Date(time.getTime() + 30 * 60 * 1000);

        // Predictable pattern
        // Day 1: Clean
        // Day 2: Dirty
        const isDay1 = i < 48;

        data.push({
            from: time.toISOString(),
            to: toTime.toISOString(),
            generationmix: [
                { fuel: "biomass", perc: 5 },
                { fuel: "coal", perc: 0 },
                { fuel: "imports", perc: 5 },
                { fuel: "gas", perc: isDay1 ? 10 : 80 },
                { fuel: "nuclear", perc: 10 },
                { fuel: "other", perc: 0 },
                { fuel: "hydro", perc: 5 },
                { fuel: "solar", perc: 5 },
                { fuel: "wind", perc: isDay1 ? 60 : 5 },
            ],
        });
    }
    return { data };
};

describe("Energy Service", () => {
    let fetchSpy: any;

    beforeAll(() => {
        fetchSpy = spyOn(global, "fetch");
    });

    beforeEach(() => {
        // Reset mock
        fetchSpy.mockImplementation(async (url: string) => {
            const today = startOfDay(new Date());
            // 3 days data
            const mockResponse = createMockGenerationData(today, 3);

            return new Response(JSON.stringify(mockResponse), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        });
    });

    afterAll(() => {
        fetchSpy.mockRestore();
    });

    describe("getEnergyMix", () => {
        test("should return energy mix for 3 days", async () => {
            const result = await getEnergyMix();

            expect(result).toHaveLength(3);

            // Structure check
            expect(result[0]).toHaveProperty("date");
            expect(result[0]).toHaveProperty("cleanEnergyPerc");
            expect(result[0]).toHaveProperty("mix");

            // Day 1 high clean
            // Expected: 85
            expect(result[0].cleanEnergyPerc).toBe(85);
            expect(result[0].mix.wind).toBe(60);

            // Day 2 low clean
            // Expected: 30
            expect(result[1].cleanEnergyPerc).toBe(30);
            expect(result[1].mix.gas).toBe(80);
        });
    });

    describe("calculateOptimalChargingWindow", () => {
        test("should find the best window with highest clean energy", async () => {
            // Expect Day 1 window
            const durationHours = 3;
            const result = await calculateOptimalChargingWindow(durationHours);

            expect(result).toHaveProperty("startTime");
            expect(result).toHaveProperty("endTime");
            expect(result).toHaveProperty("cleanEnergyPerc");

            // Expect 85 avg
            expect(result.cleanEnergyPerc).toBe(85);

            // Start day 1
            const startTime = new Date(result.startTime);
            const today = startOfDay(new Date());

            // Verify day
            expect(startTime.getDate()).toBe(today.getDate());
        });

        test("should throw error if not enough data", async () => {
            // Mock empty data
            fetchSpy.mockImplementation(async () => {
                return new Response(JSON.stringify({ data: [] }), {
                    status: 200,
                });
            });

            try {
                await calculateOptimalChargingWindow(1);
            } catch (e: any) {
                expect(e.message).toContain("Not enough data");
            }
        });
    });
});
