export const encode = (str: string) =>
    str.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-")