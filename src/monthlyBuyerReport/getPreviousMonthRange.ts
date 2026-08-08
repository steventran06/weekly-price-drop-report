export interface MonthRange {
  year: number;
  month: number;
  monthName: string;

  startDate: Date;
  endDate: Date;

  gmailAfter: string;
  gmailBefore: string;

  storagePrefix: string;
}

export function getPreviousMonthRange(
  now = new Date(),
): MonthRange {
  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "America/Los_Angeles",
        year: "numeric",
        month: "numeric",
      },
    );

  const parts =
    formatter.formatToParts(
      now,
    );

  const currentYear =
    Number(
      parts.find(
        (part) =>
          part.type === "year",
      )?.value,
    );

  const currentMonth =
    Number(
      parts.find(
        (part) =>
          part.type === "month",
      )?.value,
    );

  if (
    !currentYear ||
    !currentMonth
  ) {
    throw new Error(
      "Could not determine current Portland month.",
    );
  }

  const previousMonthDate =
    new Date(
      Date.UTC(
        currentYear,
        currentMonth - 2,
        1,
      ),
    );

  const year =
    previousMonthDate.getUTCFullYear();

  const month =
    previousMonthDate.getUTCMonth() + 1;

  const monthName =
    new Intl.DateTimeFormat(
      "en-US",
      {
        month: "long",
        timeZone: "UTC",
      },
    ).format(
      previousMonthDate,
    );

  const nextMonthDate =
    new Date(
      Date.UTC(
        year,
        month,
        1,
      ),
    );

  const endDate =
    new Date(
      nextMonthDate.getTime() - 1,
    );

  const gmailAfter =
    formatGmailDate(
      year,
      month,
      1,
    );

  const gmailBefore =
    formatGmailDate(
      nextMonthDate.getUTCFullYear(),
      nextMonthDate.getUTCMonth() + 1,
      1,
    );

  const storagePrefix =
    `${year}-${String(
      month,
    ).padStart(2, "0")}`;

  return {
    year,
    month,
    monthName,

    startDate:
      previousMonthDate,

    endDate,

    gmailAfter,
    gmailBefore,

    storagePrefix,
  };
}

function formatGmailDate(
  year: number,
  month: number,
  day: number,
): string {
  return [
    year,
    String(month).padStart(
      2,
      "0",
    ),
    String(day).padStart(
      2,
      "0",
    ),
  ].join("/");
}