const MESSAGE = require('../models/MESSAGE');

module.exports.GetUserMessage = async (req, res) => {
    try {
        const messages = await MESSAGE.find({ userId: req.user._id })
            .populate('userId', 'name email')
            .sort({ createdAt: 1 });

        res.json({ messages });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}




// Updated GetAdminMessage function to include user status and tags
module.exports.GetAdminMessage = async (req, res) => {
    try {
        // Get all users who have sent messages
        const usersWithMessages = await MESSAGE.aggregate([
            {
                $group: {
                    _id: "$userId",
                    lastMessage: { $last: "$$ROOT" },
                    unreadCount: {
                        $sum: {
                            $cond: [
                                { $and: [{ $eq: ["$isAdmin", false] }, { $eq: ["$isRead", false] }] },
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "user"
                }
            },
            {
                $unwind: "$user"
            },
            {
                $project: {
                    _id: "$user._id",
                    name: "$user.name",
                    email: "$user.email",
                    lastMessage: {
                        text: "$lastMessage.text",
                        createdAt: "$lastMessage.createdAt",
                        isAdmin: "$lastMessage.isAdmin"
                    },
                    unreadCount: 1,
                    hasUnread: { $gt: ["$unreadCount", 0] },
                    // Add mock data for new features
                    isOnline: { $literal: Math.random() > 0.5 }, // Mock online status
                    lastSeen: { 
                        $cond: [
                            { $eq: [{ $literal: Math.random() > 0.5 }, true] },
                            new Date(),
                            new Date(Date.now() - 3600000)
                        ]
                    }, // Mock last seen
                    tags: { 
                        $literal: ["VIP", "Frequent Buyer"].slice(0, Math.floor(Math.random() * 3)) 
                    } // Mock tags
                }
            },
            { $sort: { "lastMessage.createdAt": -1 } }
        ]);

        // Filter out users who have never sent a message
        const usersWithActualMessages = usersWithMessages.filter(user => user.lastMessage);

        res.json({ users: usersWithActualMessages });
    } catch (error) {
        console.error("Error fetching admin messages:", error);
        res.status(500).json({ error: error.message });
    }
}
// controllers/message.js - Updated GetAdminMessage function
// module.exports.GetAdminMessage = async (req, res) => {
//     try {
//         // Get all users who have sent messages
//         const usersWithMessages = await MESSAGE.aggregate([
//             {
//                 $group: {
//                     _id: "$userId",
//                     lastMessage: { $last: "$$ROOT" },
//                     unreadCount: {
//                         $sum: {
//                             $cond: [
//                                 { $and: [{ $eq: ["$isAdmin", false] }, { $eq: ["$isRead", false] }] },
//                                 1,
//                                 0
//                             ]
//                         }
//                     }
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "users",
//                     localField: "_id",
//                     foreignField: "_id",
//                     as: "user"
//                 }
//             },
//             {
//                 $unwind: "$user"
//             },
//             {
//                 $project: {
//                     _id: "$user._id",
//                     name: "$user.name",
//                     email: "$user.email",
//                     lastMessage: {
//                         text: "$lastMessage.text",
//                         createdAt: "$lastMessage.createdAt",
//                         isAdmin: "$lastMessage.isAdmin"
//                     },
//                     unreadCount: 1,
//                     hasUnread: { $gt: ["$unreadCount", 0] }
//                 }
//             },
//             { $sort: { "lastMessage.createdAt": -1 } }
//         ]);

//         // Filter out users who have never sent a message
//         const usersWithActualMessages = usersWithMessages.filter(user => user.lastMessage);

//         res.json({ users: usersWithActualMessages });
//     } catch (error) {
//         console.error("Error fetching admin messages:", error);
//         res.status(500).json({ error: error.message });
//     }
// }