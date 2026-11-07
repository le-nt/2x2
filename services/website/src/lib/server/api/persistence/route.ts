// * this is very spaghetti because roblox's system is very dumb
import { Elysia, t } from "elysia";
import logger from "@/util/logger";
import prisma from "@/prisma";

const persistence = new Elysia({ prefix: "/persistence" });
persistence.post("/getV2", async ({ query, set, body }) => {
    const formData = body as FormData;
    const isSorted = query.dataType !== "standard";

    // * check if place exists
    const place = await prisma.place.findUnique({
        where: { id: query.placeId }
    });
    if(!place) {
        set.status = 404;
        return { success: false, error: "BadRequest", code: 400, message: "The place does not exist" }
    }

    let count = 0;
    const data: Array<{
        Value: string | bigint | null
        Scope: string
        Target: string
        Key: string
    }> = []

    while (true) {
        const scope = formData.get(`qkeys[${count}].scope`) as string | null
        const target = formData.get(`qkeys[${count}].target`) as string | null
        const key = formData.get(`qkeys[${count}].key`) as string | null
        if (!scope || !target || !key)
            break;
        
        const entry = await prisma.dataStore.findFirst({
            where: {
                universeId: place.universeId,
                key: key,
                scope: scope,
                value: isSorted ? { not: null } : null
            }
        })
        if (!entry)
            break

        data.push({
            Value: isSorted ? entry.valueInt : entry.value,
            Key: entry.key,
            Scope: entry.scope,
            Target: entry.target
        })
        count++
    }

    return { data }
}, {
    accessKey: true,
    query: t.Object({
        placeId: t.Number(),
        dataType: t.Union([
            t.Literal("standard"),
            t.Literal("sorted")
        ]),
    })
});

persistence.post("/set", async ({ query, set, body }) => {
    const { value } = body;
    const isSorted = query.dataType !== 'standard';

    if(isSorted && !Number(value)) {
        set.status = 400;
        return { success: false, error: "BadRequest", code: 400, message: "Invalid value sent" }
    }
    if(query.valueLength > 1024 * 1024) {
        set.status = 400;
        logger.warn("Attempted to save datastore value bigger than max limit");
        return { success: false, error: "BadRequest", code: 400, message: "Value is too big, cannot save" }
    }

    // * check if place exists
    const place = await prisma.place.findUnique({
        where: { id: query.placeId },
    });
    if(!place) {
        set.status = 404;
        return { success: false, error: "BadRequest", code: 400, message: "The place does not exist" }
    }

    const dataToSet = isSorted
        ? { valueInt: Number(value) }
        : { value: String(value) }

    await prisma.dataStore.upsert({
        where: {
            universeId_key_scope_target: {
                universeId: place.universeId,
                key: query.key,
                scope: query.scope,
                target: query.target,
            },
        },
        update: { ...dataToSet },
        create: {
            key: query.key,
            scope: query.scope,
            target: query.target,
            universeId: place.universeId,
            ...dataToSet
        },
    });

    return { data: value }
}, {
    accessKey: true,
    query: t.Object({
        placeId: t.Number(),
        key: t.String(),
        target: t.String(),
        scope: t.String(),
        dataType: t.Union([
            t.Literal("standard"),
            t.Literal("sorted")
        ]),
        valueLength: t.Number()
    }),
    body: t.Object({
        value: t.Union([ t.Number(), t.String() ]),
    }),
    parse: "formdata"
});

persistence.post("/getSortedValues", async ({ query, set }) => {
    // * values used for sorting
    const minValue = query.inclusiveMinValue;
    const maxValue = query.exclusiveMaxValue;

    // * check if place exists
    const place = await prisma.place.findUnique({
        where: { id: query.placeId }
    });
    if(!place) {
        set.status = 404;
        return { success: false, error: "BadRequest", code: 400, message: "The place does not exist" }
    }

    const entries = await prisma.dataStore.findMany({
        where: {
            universeId: place.universeId,
            scope: query.scope,
            key: query.key,
            valueInt: {
                not: null,
                ...(minValue !== undefined ? { gte: minValue } : {}),
                ...(maxValue !== undefined ? { lte: maxValue } : {}),
            },
        },
        orderBy: {
            valueInt: query.ascending ? 'asc' : 'desc',
        },
        select: {
            target: true,
            valueInt: true,
        },
        skip: query.exclusiveStartKey,
        take: query.pageSize,
    })

    const nextStartKey = entries.length === query.pageSize
        ? query.exclusiveStartKey + query.pageSize
        : null;

    return { 
        data: {
            Entries: entries.map(entry => ({
                Target: entry.target,
                Value: entry.valueInt,
            })),
            ExclusiveStartKey: nextStartKey,
        }
    }
}, {
    accessKey: true,
    query: t.Object({
        placeId: t.Number(),
        key: t.String(),
        scope: t.String(),
        pageSize: t.Number(),
        exclusiveStartKey: t.Number(),
        ascending: t.Boolean(),
        inclusiveMinValue: t.Optional(t.Number()),
        exclusiveMaxValue: t.Optional(t.Number())
    })
});

export default persistence;