const Author = require("../models/author");
const Book = require("../models/book");
const asyncHandler = require("express-async-handler");
const { body, validationResult } = require("express-validator");

// 显示完整的作者列表
exports.author_list = async function (req, res, next) {
  try {
    const list_authors = await Author.find()
      .sort([["family_name", "ascending"]])
      .exec();
    res.render("author_list", {
      title: "Author List",
      author_list: list_authors,
    });
  } catch (err) {
    return next(err);
  }
};

// 为每位作者显示详细信息的页面
exports.author_detail = asyncHandler(async (req, res, next) => {
  // 并行获取作者的详细信息及其所有作品
  const [author, allBooksByAuthor] = await Promise.all([
    Author.findById(req.params.id).exec(),
    Book.find({ author: req.params.id }, "title summary").exec(),
  ]);

  if (author === null) {
    // 没有找到
    const err = new Error("Author not found");
    err.status = 404;
    return next(err);
  }

  res.render("author_detail", {
    title: "Author Detail",
    author: author,
    author_books: allBooksByAuthor,
  });
});

// 由 GET 显示创建作者的表单
exports.author_create_get = (req, res, next) => {
  res.render("author_form", { title: "Create Author" });
};

// 处理 POST 方法提交的创建作者表单
exports.author_create_post = [
  // 验证并且清理字段
  body("first_name")
    .trim()
    .isLength({ min: 1 })
    .escape()
    .withMessage("First name must be specified.")
    .isAlphanumeric()
    .withMessage("First name has non-alphanumeric characters."),
  body("family_name")
    .trim()
    .isLength({ min: 1 })
    .escape()
    .withMessage("Family name must be specified.")
    .isAlphanumeric()
    .withMessage("Family name has non-alphanumeric characters."),
  body("date_of_birth", "Invalid date of birth")
    .optional({ values: "falsy" })
    .isISO8601()
    .toDate(),
  body("date_of_death", "Invalid date of death")
    .optional({ values: "falsy" })
    .isISO8601()
    .toDate(),

  // 在验证和修整完字段后处理请求
  asyncHandler(async (req, res, next) => {
    // 从请求中提取验证错误
    const errors = validationResult(req);

    // 使用经转义和去除空白字符处理的数据创建作者对象
    const author = new Author({
      first_name: req.body.first_name,
      family_name: req.body.family_name,
      date_of_birth: req.body.date_of_birth,
      date_of_death: req.body.date_of_death,
    });

    if (!errors.isEmpty()) {
      // 出现错误，使用清理后的值/错误信息重新渲染表单
      res.render("author_form", {
        title: "Create Author",
        author: author,
        errors: errors.array(),
      });
      return;
    } else {
      // 表格中的数据有效 保存作者信息
      await author.save();
      // 重定向到新的作者记录
      res.redirect(author.url);
    }
  }),
];

// 由 GET 显示删除作者的表单
exports.author_delete_get = async function (req, res, next) {
  try {
    // 并行执行两个查询操作
    const [author, authors_books] = await Promise.all([
      Author.findById(req.params.id).exec(),
      Book.find({ author: req.params.id }).exec(),
    ]);

    // 如果没有找到作者，重定向到作者列表
    if (author == null) {
      return res.redirect("/catalog/authors");
    }

    // 渲染删除确认页面
    res.render("author_delete", {
      title: "Delete Author",
      author: author,
      author_books: authors_books,
    });
  } catch (err) {
    return next(err);
  }
};

// 由 POST 处理作者删除操作
exports.author_delete_post = async function (req, res, next) {
  try {
    // 并行执行两个查询操作
    const [author, authors_books] = await Promise.all([
      Author.findById(req.body.authorid).exec(),
      Book.find({ author: req.body.authorid }).exec(),
    ]);

    // 检查是否有错误
    if (!author) {
      return res.redirect("/catalog/authors");
    }

    // Success
    if (authors_books.length > 0) {
      // Author has books. Render in same way as for GET route.
      return res.render("author_delete", {
        title: "Delete Author",
        author: author,
        author_books: authors_books,
      });
    } else {
      // Author has no books. Delete object and redirect to the list of authors.
      await Author.findOneAndDelete({ _id: req.body.authorid });
      // Success - go to author list
      res.redirect("/catalog/authors");
    }
  } catch (err) {
    return next(err);
  }
};

// 由 GET 显示更新作者的表单
exports.author_update_get = async (req, res, next) => {
  try {
    // 使用 Promise.all 并行查询
    const author = await Author.findById(req.params.id).exec();
    // 如果没有找到
    if (!author) {
      const err = new Error("Book not found");
      err.status = 404;
      return next(err);
    }

    // 渲染表单
    res.render("author_form", {
      title: "Update Author",
      author: {
        ...author.toObject(),
        date_of_birth: author.date_of_birth
          ? author.date_of_birth.toISOString().split("T")[0]
          : "",
        date_of_death: author.date_of_death
          ? author.date_of_death.toISOString().split("T")[0]
          : "",
      },
    });
  } catch (err) {
    return next(err);
  }
};

// 由 POST 处理作者更新操作
exports.author_update_post = [
  // 验证并且清理字段
  body("first_name")
    .trim()
    .isLength({ min: 1 })
    .escape()
    .withMessage("First name must be specified.")
    .isAlphanumeric()
    .withMessage("First name has non-alphanumeric characters."),
  body("family_name")
    .trim()
    .isLength({ min: 1 })
    .escape()
    .withMessage("Family name must be specified.")
    .isAlphanumeric()
    .withMessage("Family name has non-alphanumeric characters."),
  body("date_of_birth", "Invalid date of birth")
    .optional({ values: "falsy" })
    .isISO8601()
    .toDate(),
  body("date_of_death", "Invalid date of death")
    .optional({ values: "falsy" })
    .isISO8601()
    .toDate(),

  // 在验证和修整完字段后处理请求
  asyncHandler(async (req, res, next) => {
    // 从请求中提取验证错误
    const errors = validationResult(req);

    // 使用经转义和去除空白字符处理的数据创建作者对象
    const author = new Author({
      first_name: req.body.first_name,
      family_name: req.body.family_name,
      date_of_birth: req.body.date_of_birth,
      date_of_death: req.body.date_of_death,
      _id: req.params.id,
    });

    if (!errors.isEmpty()) {
      // 出现错误。使用清理后的值/错误信息重新渲染表单
      res.render("author_form", {
        title: "Update Author",
        author: author,
        errors: errors.array(),
      });
      return;
    } else {
      // 表格中的数据有效 更新作者信息
      const updatedAuthor = await Author.findByIdAndUpdate(
        req.params.id,
        author,
        {
          new: true,
          runValidators: true,
        },
      ).exec();
      // Success - redirect to book detail page
      res.redirect(updatedAuthor.url);
    }
  }),
];
