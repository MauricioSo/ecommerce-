export type CustomerVerificationPort = {
  findCustomerByEmail(email: string): Promise<{ id: string; emailVerifiedAt: Date | null } | null>;
  findCustomerById(id: string): Promise<{ id: string; emailVerifiedAt: Date | null } | null>;
};
