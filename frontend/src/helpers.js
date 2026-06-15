export function applyUserFromResponse(data, onUserUpdate) {
  if (data?.exp !== undefined) {
    onUserUpdate({
      exp: data.exp,
      level: data.level,
      title: data.title,
      next_level_exp: data.next_level_exp,
      next_level_title: data.next_level_title,
    });
  }
}
