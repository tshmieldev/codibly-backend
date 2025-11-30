import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import {
    getEnergyMix,
    calculateOptimalChargingWindow,
} from "./services/energyService";

const app = new Hono();

// CORS
app.use("/*", cors());

app.get("/", (c) => {
    return c.text("Codibly Recruitment Task API");
});

// Get energy mix
app.get("/energy-mix", async (c) => {
    try {
        const data = await getEnergyMix();
        return c.json(data);
    } catch (error) {
        console.error("Error fetching energy mix:", error);
        return c.json({ error: "Failed to fetch energy mix data" }, 500);
    }
});

// Validation schema
const chargingSchema = z.object({
    hours: z
        .string()
        .transform((val) => parseInt(val, 10))
        .refine((val) => !isNaN(val) && val >= 1 && val <= 6, {
            message: "Hours must be a number between 1 and 6",
        }),
});

// Calculate optimal charging window
app.get("/optimal-charging", async (c) => {
    const query = c.req.query();

    const result = chargingSchema.safeParse(query);

    if (!result.success) {
        return c.json({ error: result.error.flatten() }, 400);
    }

    const { hours } = result.data;

    try {
        const window = await calculateOptimalChargingWindow(hours);
        return c.json(window);
    } catch (error) {
        console.error("Error calculating optimal window:", error);
        return c.json(
            { error: "Failed to calculate optimal charging window" },
            500,
        );
    }
});

export default {
    port: 4000,
    fetch: app.fetch,
};
