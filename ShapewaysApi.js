module.exports = Object.freeze({
    Base: 'http://api.shapeways.com',
    get OAuth1() {
        return this.Base + '/oauth1';   
    },
    get Cart() {
        return this.Base + '/cart/v1';
    },
    get Materials() {
        return this.Base + '/materials/v1';
    },
    get Model() {
        return this.Base + '/models/v1';
    },
    get Printers() {
        return this.Base + '/printers/v1';
    },
    get Price() {
        return this.Base + '/price/v1';
    },
    get Category() {
        return this.Base + '/catergories/v1';   
    },
    get Order() {
        return this.Base + '/orders/v1';   
    }
});
