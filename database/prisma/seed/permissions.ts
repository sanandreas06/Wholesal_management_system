export const permissions = [
  ["organization", "READ"],
  ["organization", "UPDATE"],

  ["region", "READ"],
  ["region", "CREATE"],
  ["region", "UPDATE"],
  ["region", "DELETE"],

  ["branch", "READ"],
  ["branch", "CREATE"],
  ["branch", "UPDATE"],
  ["branch", "DELETE"],

  ["user", "READ"],
  ["user", "CREATE"],
  ["user", "UPDATE"],
  ["user", "DELETE"],

  ["role", "READ"],
  ["role", "CREATE"],
  ["role", "UPDATE"],
  ["role", "DELETE"],

  ["permission", "READ"],

  ["product", "READ"],
  ["product", "CREATE"],
  ["product", "UPDATE"],
  ["product", "DELETE"],

  ["inventory", "READ"],
  ["inventory", "CREATE"],
  ["inventory", "UPDATE"],

  ["sales", "READ"],
  ["sales", "CREATE"],
  ["sales", "UPDATE"],

  ["reports", "READ"],
  ["reports", "EXPORT"],
] as const;