const Genre = require("../models/genre");
const asyncHandler = require("express-async-handler");
const Book = require("../models/book");
const { body, validationResult } = require("express-validator");

// 显示所有的流派
exports.genre_list = asyncHandler(async (req, res, next) => {
  try {
    const list_genres = await Genre.find()
      .sort([["name", "ascending"]])
      .exec();
    res.render("genre_list", {
      title: "Genre List",
      genre_list: list_genres,
    });
  } catch (err) {
    return next(err);
  }
});

// 显示特定流派的详情页
exports.genre_detail = async function (req, res, next) {
  try {
    // 并行执行两个查询
    const [genre, genre_books] = await Promise.all([
      Genre.findById(req.params.id).exec(),
      Book.find({ genre: req.params.id }).exec(),
    ]);

    // 检查是否找到类型
    if (genre == null) {
      const err = new Error("Genre not found");
      err.status = 404;
      return next(err);
    }

    // 渲染详情页面
    res.render("genre_detail", {
      title: "Genre Detail",
      genre: genre,
      genre_books: genre_books,
    });
  } catch (err) {
    return next(err);
  }
};

// 呈现 GET 方法获取的 Genre 表单
exports.genre_create_get = (req, res, next) => {
  res.render("genre_form", { title: "Create Genre" });
};

// 处理 POST 方法创建的 Genre
exports.genre_create_post = [
  // 验证及清理名称字段
  body("name", "Genre name must contain at least 3 characters")
    .trim()
    .isLength({ min: 3 })
    .escape(),

  // 处理验证及清理过后的请求
  asyncHandler(async (req, res, next) => {
    // 从请求中提取验证时产生的错误信息
    const errors = validationResult(req);

    // 使用经去除空白字符和转义处理的数据创建一个类型对象
    const genre = new Genre({ name: req.body.name });

    if (!errors.isEmpty()) {
      // 出现错误。使用清理后的值/错误信息重新渲染表单
      res.render("genre_form", {
        title: "Create Genre",
        genre: genre,
        errors: errors.array(),
      });
      return;
    } else {
      // 表格中的数据有效
      // 检查是否存在同名的 Genre
      const genreExists = await Genre.findOne({ name: req.body.name })
        .collation({ locale: "en", strength: 2 })
        .exec();
      if (genreExists) {
        // 存在同名的 Genre，则重定向到详情页面
        res.redirect(genreExists.url);
      } else {
        await genre.save();
        // 保存新创建的 Genre，然后重定向到类型的详情页面
        res.redirect(genre.url);
      }
    }
  }),
];

// 通过 GET 显示流派删除表单
exports.genre_delete_get = asyncHandler(async (req, res, next) => {
  try {
    // 并行执行两个查询操作
    const [genre, genre_books] = await Promise.all([
      Genre.findById(req.params.id).exec(),
      Book.find({ genre: req.params.id }).exec(),
    ]);

    // 如果没有找到，重定向到列表
    if (genre == null) {
      return res.redirect("/catalog/genres");
    }

    // 渲染删除确认页面
    res.render("genre_delete", {
      title: "Delete Genre",
      genre: genre,
      genre_books: genre_books,
    });
  } catch (err) {
    return next(err);
  }
});

// 处理 POST 时的流派删除
exports.genre_delete_post = asyncHandler(async (req, res, next) => {
  try {
    // 并行执行两个查询操作
    const [genre, genre_books] = await Promise.all([
      Genre.findById(req.body.genreid).exec(),
      Book.find({ genre: req.body.genreid }).exec(),
    ]);
    // 检查是否有错误
    if (!genre) {
      return res.redirect("/catalog/genres");
    }

    // Success
    if (genre_books.length > 0) {
      // Author has books. Render in same way as for GET route.
      return res.render("genre_delete", {
        title: "Delete Genre",
        genre: genre,
        genre_books: genre_books,
      });
    } else {
      // Author has no books. Delete object and redirect to the list of authors.
      await Genre.findOneAndDelete({ _id: req.body.genreid });
      // Success - go to author list
      res.redirect("/catalog/genres");
    }
  } catch (err) {
    return next(err);
  }
});

// 通过 GET 显示流派更新表单
exports.genre_update_get = asyncHandler(async (req, res, next) => {
  try {
    // 使用 Promise.all 并行查询
    const genre = await Genre.findById(req.params.id).exec();
    // 如果没有找到
    if (!genre) {
      const err = new Error("Book not found");
      err.status = 404;
      return next(err);
    }

    // 渲染表单
    res.render("genre_form", {
      title: "Update Genre",
      genre: genre,
    });
  } catch (err) {
    return next(err);
  }
});

// 处理 POST 上的流派更新
exports.genre_update_post = [
  // 验证及清理名称字段
  body("name", "Genre name must contain at least 3 characters")
    .trim()
    .isLength({ min: 3 })
    .escape(),

  // 处理验证及清理过后的请求
  asyncHandler(async (req, res, next) => {
    // 从请求中提取验证时产生的错误信息
    const errors = validationResult(req);

    // 使用经去除空白字符和转义处理的数据创建一个类型对象
    const genre = new Genre({ name: req.body.name, _id: req.params.id });

    if (!errors.isEmpty()) {
      // 出现错误。使用清理后的值/错误信息重新渲染表单
      res.render("genre_form", {
        title: "Update Genre",
        genre: genre,
        errors: errors.array(),
      });
      return;
    } else {
      const updatedGenre = await Genre.findByIdAndUpdate(req.params.id, genre, {
        new: true,
        runValidators: true,
      }).exec();
      res.redirect(updatedGenre.url);
    }
  }),
];
