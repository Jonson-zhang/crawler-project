require("./01_env.js")
require("./02_code.js");


function my_a_bogus(p) {
    const bogus = window.bogus;

    const r = bogus._v;

    const args = [
        0,
        1,
        8,
        p,
        "",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36"
    ];

    return bogus._u(r[0], args, r[1], r[2], null);
}

//以下是供调试时使用，使用python调取接口时，需要注释掉
// zz = 'gtABSux8LsTidatAsMKqxhVHKkE3BoV7rj3DtwE97eYLU806Wa8lVjosZLr54BOiPMydMfqOv66KUpqjJnowTU6A_bLe2Q2k3gxDwMM4nUiWvwKZfJdK8MMALrncFUc='
// b = my_a_bogus(zz)
// console.log(b, b.length)