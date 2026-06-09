import "express-session";

// Augment express-session so req.session.userId / adminId are typed everywhere.
declare module "express-session" {
  interface SessionData {
    userId?: string;
    adminId?: string;
  }
}
