class NetUtils {
    static isPrivateIP(ip) {
        if (NetUtils.isIPv4Address(ip)) {
            for (const subnet of NetUtils.IPv4_PRIVATE_NETWORK) {
                if (NetUtils.isIPv4inSubnet(ip, subnet)) {
                    return true;
                }
            }
            return false;
        }

        if (NetUtils.isIPv6Address(ip)) {
            const parts = ip.toLowerCase().split(':');
            const isEmbeddedIPv4 = NetUtils.isIPv4Address(parts[parts.length - 1]);
            if (isEmbeddedIPv4) {
                return NetUtils.isPrivateIP(parts[parts.length - 1]);
            }
            if ((parseInt(parts[0], 16) & (-1 << 9)) === 0xfc00) {
                return true;
            }
            if ((parseInt(parts[0], 16) & (-1 << 6)) === 0xfe80) {
                return true;
            }
            return false;
        }

        throw `Malformed IP address ${ip}`;
    }

    static isIPv4inSubnet(ip, subnet) {
        let [subIp, mask] = subnet.split('/');
        mask = -1 << (32 - parseInt(mask));
        return (NetUtils._IPv4toLong(ip) & mask) === NetUtils._IPv4toLong(subIp);
    }

    static isIPv4Address(ip) {
        const match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
        return !!match && parseInt(match[1]) <= 255 && parseInt(match[2]) <= 255 &&
            parseInt(match[3]) <= 255 && parseInt(match[4]) <= 255;
    }

    static isIPv6Address(ip) {
        const parts = ip.toLowerCase().split(':');
        if (parts.length > 8 || parts.length < 3) {
            return false;
        }

        const isEmbeddedIPv4 = NetUtils.isIPv4Address(parts[parts.length - 1]);

        let innerEmpty = false;
        for (let i = 0; i < parts.length; ++i) {
            if (!(/^[a-f0-9]{0,4}$/.test(parts[i]) ||
                    (i === parts.length - 1 &&
                        isEmbeddedIPv4 &&
                        parts.length < 8))) {
                return false;
            }
            if (parts[i].length === 0 && i > 0 && i < parts.length - 1) {
                if (innerEmpty) {
                    return false;
                }
                innerEmpty = true;
            }
        }
        if (isEmbeddedIPv4) {
            // Exclude the last two parts.
            for (let i = 0; i < parts.length - 2; ++i) {
                if (!/^0{0,4}$/.test(parts[i])) {
                    return false;
                }
            }
        }
        if (parts[0].length === 0) {
            return parts[1].length === 0;
        }
        if (parts[parts.length - 1].length === 0) {
            return parts[parts.length - 2].length === 0;
        }
        if (isEmbeddedIPv4 && parts.length < 7) {
            return innerEmpty;
        }
        if (parts.length < 8) {
            return innerEmpty;
        }
        return true;
    }

    static sanitizeIP(ip) {
        const saneIp = NetUtils._normalizeIP(ip);
        if (NetUtils.IP_BLACKLIST.indexOf(saneIp) >= 0) {
            throw `Malformed IP address ${ip}`;
        }
        return saneIp;
    }

    static _normalizeIP(ip) {
        if (NetUtils.isIPv4Address(ip)) {
            const match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
            return `${parseInt(match[1])}.${parseInt(match[2])}.${parseInt(match[3])}.${parseInt(match[4])}`;
        }

        if (NetUtils.isIPv6Address(ip)) {
            ip = ip.toLowerCase();
            const parts = ip.split(':');
            if (NetUtils.isIPv4Address(parts[parts.length - 1])) {
                return NetUtils._normalizeIP(parts[parts.length - 1]);
            }
            const emptyIndex = parts.indexOf('');
            if (emptyIndex >= 0) {
                parts[emptyIndex] = '0';
                if (emptyIndex > 0 && parts[emptyIndex - 1] === '') {
                    parts[emptyIndex - 1] = '0';
                }
                if (emptyIndex < parts.length - 1 && parts[emptyIndex + 1] === '') {
                    parts[emptyIndex + 1] = '0';
                }
                const necessaryAddition = 8 - parts.length;
                for (let i = 0; i < necessaryAddition; ++i) {
                    parts.splice(emptyIndex, 0, '0');
                }
            }

            let maxZeroSeqStart = -1;
            let maxZeroSeqLength = 0;
            let curZeroSeqStart = -1;
            let curZeroSeqLength = 1;
            for (let i = 0; i < parts.length; ++i) {
                parts[i] = parts[i].replace(/^0+([a-f0-9])/, '$1');
                if (parts[i] === '0') {
                    if (curZeroSeqStart < 0) {
                        curZeroSeqStart = i;
                    } else {
                        curZeroSeqLength++;
                    }
                } else {
                    if (curZeroSeqStart >= 0 && curZeroSeqLength > maxZeroSeqLength) {
                        maxZeroSeqStart = curZeroSeqStart;
                        maxZeroSeqLength = curZeroSeqLength;
                        curZeroSeqStart = -1;
                        curZeroSeqLength = 1;
                    }
                }
            }

            if (curZeroSeqStart >= 0 && curZeroSeqLength > maxZeroSeqLength) {
                maxZeroSeqStart = curZeroSeqStart;
                maxZeroSeqLength = curZeroSeqLength;
            }

            if (maxZeroSeqStart >= 0 && maxZeroSeqLength > 1) {
                if (maxZeroSeqLength === parts.length) {
                    return '::';
                } else if (maxZeroSeqStart === 0 || maxZeroSeqStart + maxZeroSeqLength === parts.length) {
                    parts.splice(maxZeroSeqStart, maxZeroSeqLength, ':');
                } else {
                    parts.splice(maxZeroSeqStart, maxZeroSeqLength, '');
                }
            }

            return parts.join(':');
        }

        throw `Malformed IP address ${ip}`;
    }

    static _IPv4toLong(ip) {
        const match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
        return (parseInt(match[1]) << 24) + (parseInt(match[2]) << 16) + (parseInt(match[3]) << 8) + (parseInt(match[4]));
    }
}
NetUtils.IP_BLACKLIST = [
    '0.0.0.0',
    '127.0.0.1',
    '255.255.255.255',
    '::',
    '::1'
];
NetUtils.IPv4_PRIVATE_NETWORK = [
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    '100.64.0.0/10',
    '169.254.0.0/16'
];
Class.register(NetUtils);
