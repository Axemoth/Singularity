import {corsair} from './corsair';

const main = async () => {
    const res = await corsair.withTenant('dev').gmail.api.threads.list({});
    console.log(res);
}

main();