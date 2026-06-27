/**
 * 前台作者名展示：作者为管理员时显示「<设置的管理员名 或 作者本名>（管理员）」，
 * 否则用作者本人的 displayName。adminName 取自设置 author.adminName。
 */
export function formatAuthorName(
  author: { displayName: string; role: string },
  adminName: string,
): string {
  if (author.role === "ADMIN") {
    return `${adminName.trim() || author.displayName}（管理员）`;
  }
  return author.displayName;
}
