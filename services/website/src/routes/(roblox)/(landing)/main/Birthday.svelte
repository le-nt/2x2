<script lang="ts">
    let {
        month = $bindable(),
        day = $bindable(),
        year = $bindable(),
        invalid = $bindable(),
        valid = $bindable(),
    } = $props<{
        month: string;
        day: number;
        year: number;
        invalid?: boolean;
        valid?: boolean;
    }>();

    type MonthCode =
        | "Jan"
        | "Feb"
        | "Mar"
        | "Apr"
        | "May"
        | "Jun"
        | "Jul"
        | "Aug"
        | "Sep"
        | "Oct"
        | "Nov"
        | "Dec";

    const currentYear: number = new Date().getFullYear();
    const years: number[] = $derived(
        Array.from({ length: 100 }, (_, i) => currentYear - i),
    );

    const validDays: number = $derived.by(() => {
        if (!month) return 31;

        const monthDays: Record<MonthCode, number> = {
            Jan: 31,
            Feb: 28,
            Mar: 31,
            Apr: 30,
            May: 31,
            Jun: 30,
            Jul: 31,
            Aug: 31,
            Sep: 30,
            Oct: 31,
            Nov: 30,
            Dec: 31,
        };

        let days = monthDays[month as MonthCode] || 31;
        if (month === "Feb" && year && year > 0) {
            const isLeapYear =
                (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
            days = isLeapYear ? 29 : 28;
        }
        return days;
    });

    $effect(() => {
        if (day > validDays) {
            day = 0;
        }
    });
</script>

<div
    class="landing-form-control !flex flex-row !p-0 h-[44px] flex flex-row"
    class:invalid
    class:valid
>
    <span class="text-[18px] pt-[10px] pl-[10px] pr-[25px]">Birthday</span>
    <select class="signup-select !w-[45%]" bind:value={month}>
        <option value="" disabled selected>Month</option>
        <option value="Jan">January</option>
        <option value="Feb">February</option>
        <option value="Mar">March</option>
        <option value="Apr">April</option>
        <option value="May">May</option>
        <option value="Jun">June</option>
        <option value="Jul">July</option>
        <option value="Aug">August</option>
        <option value="Sep">September</option>
        <option value="Oct">October</option>
        <option value="Nov">November</option>
        <option value="Dec">December</option>
    </select>

    <select class="signup-select !w-[30%]" bind:value={day}>
        <option value={0} disabled selected>Day</option>
        {#each Array.from({ length: validDays }, (_, i) => i + 1) as d}
            <option value={d}>{d.toString().padStart(2, "0")}</option>
        {/each}
    </select>

    <select class="signup-select !w-[30%]" bind:value={year}>
        <option value={0} selected>Year</option>
        {#each years as y}
            <option value={y}>{y}</option>
        {/each}
    </select>
</div>

<style>
    .signup-select {
        cursor: pointer;
        border: 1px solid #b8b8b8;
        border-width: 0 0 0 1px;
        min-width: 70px;
        width: 100%;
        height: 100%;
        font-size: 18px;
        padding-top: 2px;
        padding-left: 7px;
        color: black;
        background: url(/images/Icons/icon_downarrow.svg) no-repeat scroll 98%
            10px #fff;
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
    }

    .signup-select:hover {
        background-color: #00a2ff;
        background-image: url(/images/Icons/icon_downarrow_on.svg);
        color: #fff;
    }
</style>
