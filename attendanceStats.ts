export type AttendanceCategory = "pass" | "single" | "complimentary" | "online";

type AttendanceRow = {
  userId: number;
  sessionType: AttendanceCategory;
};

type OnlineViewerRow = {
  userId: number;
};

/**
 * Combines in-person attendance with registered online attendance. Historic
 * live-stream access remains a fallback until a member's join is registered.
 * A member appearing in both sets is counted once, as in-person attendance.
 */
export function calculateSessionAttendanceStats(
  inPersonRows: AttendanceRow[],
  onlineViewerRows: OnlineViewerRow[],
) {
  const inPersonAttendance = inPersonRows.filter((row) => row.sessionType !== "online");
  const attendedMemberIds = new Set(inPersonAttendance.map((row) => row.userId));
  const onlineMemberIds = new Set(
    [
      ...onlineViewerRows.map((row) => row.userId),
      ...inPersonRows.filter((row) => row.sessionType === "online").map((row) => row.userId),
    ]
      .filter((userId) => !attendedMemberIds.has(userId)),
  );

  return {
    total: inPersonAttendance.length + onlineMemberIds.size,
    passCount: inPersonAttendance.filter((row) => row.sessionType === "pass").length,
    singleCount: inPersonAttendance.filter((row) => row.sessionType === "single").length,
    complimentaryCount: inPersonAttendance.filter((row) => row.sessionType === "complimentary").length,
    onlineCount: onlineMemberIds.size,
  };
}
