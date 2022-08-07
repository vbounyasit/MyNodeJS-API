const mongoose = require('mongoose')

mongoose.connect(process.env.MONGODB_URL,function(){
    /* Drop the DB */
    //mongoose.connection.db.dropDatabase();
})