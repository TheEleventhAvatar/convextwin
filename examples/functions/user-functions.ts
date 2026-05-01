// Example Convex functions for testing with Convex Twin

export const listUsers = async (args: any, ctx: any) => {
  const users = await ctx.db.query('users').collect();
  return { users, count: users.length };
};

export const getUser = async (args: { userId: string }, ctx: any) => {
  const user = await ctx.db.get('users').filter(u => u._id === args.userId).first();
  if (!user) {
    throw new Error(`User with ID ${args.userId} not found`);
  }
  return user;
};

export const createUser = async (args: { name: string; email: string }, ctx: any) => {
  // Check if user with email already exists
  const existingUser = await ctx.db
    .query('users')
    .filter(u => u.email === args.email)
    .first();
  
  if (existingUser) {
    throw new Error(`User with email ${args.email} already exists`);
  }

  const user = await ctx.db.insert('users', {
    name: args.name,
    email: args.email,
    createdAt: Date.now()
  });

  return user;
};

export const updateUser = async (args: { userId: string; updates: any }, ctx: any) => {
  const user = await ctx.db.patch('users', args.userId, args.updates);
  return user;
};

export const deleteUser = async (args: { userId: string }, ctx: any) => {
  // First check if user exists
  const user = await ctx.db.get('users').filter(u => u._id === args.userId).first();
  if (!user) {
    throw new Error(`User with ID ${args.userId} not found`);
  }

  // Delete all messages from this user
  const userMessages = await ctx.db
    .query('messages')
    .filter(m => m.userId === args.userId)
    .collect();

  for (const message of userMessages) {
    await ctx.db.delete('messages', message._id);
  }

  // Delete the user
  await ctx.db.delete('users', args.userId);
  
  return { success: true, deletedMessages: userMessages.length };
};

export const listMessages = async (args: { userId?: string; channel?: string }, ctx: any) => {
  let query = ctx.db.query('messages');

  if (args.userId) {
    query = query.filter(m => m.userId === args.userId);
  }

  if (args.channel) {
    query = query.filter(m => m.channel === args.channel);
  }

  const messages = await query.collect();
  return { messages, count: messages.length };
};

export const createMessage = async (args: { 
  userId: string; 
  text: string; 
  channel: string 
}, ctx: any) => {
  // Verify user exists
  const user = await ctx.db.get('users').filter(u => u._id === args.userId).first();
  if (!user) {
    throw new Error(`User with ID ${args.userId} not found`);
  }

  const message = await ctx.db.insert('messages', {
    userId: args.userId,
    text: args.text,
    channel: args.channel,
    createdAt: Date.now()
  });

  return message;
};

export const getUserStats = async (args: { userId: string }, ctx: any) => {
  const user = await ctx.db.get('users').filter(u => u._id === args.userId).first();
  if (!user) {
    throw new Error(`User with ID ${args.userId} not found`);
  }

  const messages = await ctx.db
    .query('messages')
    .filter(m => m.userId === args.userId)
    .collect();

  const messagesByChannel = messages.reduce((acc: any, message: any) => {
    if (!acc[message.channel]) {
      acc[message.channel] = 0;
    }
    acc[message.channel]++;
    return acc;
  }, {});

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email
    },
    totalMessages: messages.length,
    messagesByChannel,
    lastMessageAt: messages.length > 0 
      ? Math.max(...messages.map((m: any) => m.createdAt))
      : null
  };
};
